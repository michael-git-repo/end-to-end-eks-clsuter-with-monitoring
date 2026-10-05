import './vendor/d3-array.min.js';
import './vendor/d3-geo.min.js';
import {locateStation,coordinates,flightFrame,globeScale,clampScale,rotateGlobe,countryFlag} from './globe-state.js';
import {flagCodes} from './flag-codes.js';
const {geoOrthographic,geoPath,geoGraticule10,geoDistance}=globalThis.d3;

export function createStationGlobe({resolveStation,motionEnabled}){
  const $=id=>document.getElementById(id),scene=$('station-map'),svg=$('globe-svg');
  const projection=geoOrthographic().translate([200,185]).scale(155).rotate([-5.63,-6.34,0]).clipAngle(90);
  const path=geoPath(projection),grid=geoGraticule10();
  let world=null,current=null,version=0,frame=0,flight=null,started=false,location=null,pinReady=false,manualView=false,drag=null,flagStationId=null;
  function clearFlag(){
    flagStationId=null;$('globe-country-badge').hidden=true;$('globe-country-flag').removeAttribute('src');
    $('globe-pin-flag').setAttribute('display','none');$('globe-pin-flag-image').removeAttribute('href');
  }
  function showFlag(station){
    if(flagStationId===station.id)return;
    clearFlag();flagStationId=station.id;
    const flag=countryFlag(station.country,flagCodes);if(!flag)return;
    $('globe-country-flag').setAttribute('src',flag.path);$('globe-country-name').textContent=flag.name;
    $('globe-country-badge').hidden=false;
    $('globe-pin-flag-image').setAttribute('href',flag.path);$('globe-pin-flag').removeAttribute('display');
  }
  $('globe-country-flag').addEventListener('error',clearFlag);
  $('globe-pin-flag-image').addEventListener('error',()=>{$('globe-pin-flag').setAttribute('display','none');});
  const ready=fetch('maps/world.json',{signal:AbortSignal.timeout(15000)}).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{world=data;draw();return data;}).catch(()=>null);
  function draw(){
    $('globe-ocean').setAttribute('d',path({type:'Sphere'}));
    $('globe-grid').setAttribute('d',path(grid));
    $('globe-atmosphere').setAttribute('r',String(projection.scale()+3));
    $('globe-zoom-level').textContent=(projection.scale()/globeScale.base).toFixed(1)+'×';
    $('globe-zoom-in').disabled=projection.scale()>=globeScale.max;
    $('globe-zoom-out').disabled=projection.scale()<=globeScale.min;
    $('globe-recentre').disabled=!location;
    if(world){
      $('globe-land').setAttribute('d',path(world));
      const country=world.features.find(f=>f.properties.code===current?.country);
      $('globe-country').setAttribute('d',country?path(country):'');
    }
    const pin=$('globe-pin');
    $('globe-pin-label').setAttribute('visibility','hidden');
    if(pinReady&&location&&geoDistance(projection.invert([200,185]),location.point)<Math.PI/2-.02){
      const [x,y]=projection(location.point);
      if(x>=10&&x<=390&&y>=10&&y<=370){
        pin.setAttribute('transform',`translate(${x},${y})`);pin.removeAttribute('visibility');
        $('globe-pin-label').setAttribute('visibility',x>105&&x<295&&y<285?'visible':'hidden');
      }else pin.setAttribute('visibility','hidden');
    }else pin.setAttribute('visibility','hidden');
  }
  function stopFlight(){cancelAnimationFrame(frame);frame=0;flight=null;scene.dataset.flying='false';}
  function cancel(){version++;stopFlight();}
  function finish(){
    if(!flight)return;
    const point=flight.point;cancelAnimationFrame(frame);frame=0;
    projection.rotate([-point[0],-point[1],0]).scale(globeScale.station);pinReady=true;draw();
    scene.dataset.flying='false';flight=null;
  }
  function fly(point,spin=true){
    stopFlight();manualView=false;pinReady=false;scene.dataset.view='station';
    flight={point,spin,start:{rotation:projection.rotate(),scale:projection.scale()},at:performance.now()};
    if(!motionEnabled()||document.hidden){finish();return;}
    scene.dataset.flying='true';
    const tick=now=>{
      if(!flight)return;
      if(!motionEnabled()||document.hidden){finish();return;}
      const progress=Math.min(1,(now-flight.at)/(flight.spin?2200:650));
      const state=flightFrame(flight.start,point,progress,{spin:flight.spin});projection.rotate(state.rotation).scale(state.scale);draw();
      if(progress===1)finish();else frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
  }
  async function focus(station){
    const request=version;
    await ready;if(request!==version)return;
    let resolved=station;
    if(!coordinates(station.latitude,station.longitude)&&!station.local){
      try{const found=await resolveStation(station);if(found)resolved={...station,latitude:found.geo_lat,longitude:found.geo_long};}catch{/* Country fallback stays explicitly approximate. */}
    }
    if(request!==version)return;
    location=locateStation(resolved,world?.features||[]);
    if(!location){$('globe-location').textContent='Location not published';$('globe-coordinate').textContent='No map pin available for this station';draw();return;}
    $('globe-location').textContent=`${location.label} · ${location.precision}`;
    const [lon,lat]=location.point;
    $('globe-coordinate').textContent=`${Math.abs(lat).toFixed(2)}° ${lat<0?'S':'N'} · ${Math.abs(lon).toFixed(2)}° ${lon<0?'W':'E'} · ${location.precision}`;
    $('globe-svg').setAttribute('aria-label',`${station.name}: ${location.label}. ${location.precision}.`);
    $('globe-pin-name').textContent=station.name.length>28?station.name.slice(0,26)+'…':station.name;
    if(manualView){pinReady=true;draw();}else fly(location.point);
  }
  function interact(){stopFlight();manualView=true;pinReady=!!location;scene.dataset.view='exploring';}
  function zoom(factor){interact();projection.scale(clampScale(projection.scale()*factor));draw();}
  function reset(){interact();projection.rotate([-5.63,-6.34,0]).scale(globeScale.base);draw();}
  $('globe-zoom-in').addEventListener('click',()=>zoom(1.15));
  $('globe-zoom-out').addEventListener('click',()=>zoom(1/1.15));
  $('globe-reset').addEventListener('click',reset);
  $('globe-recentre').addEventListener('click',()=>{if(location)fly(location.point,false);});
  svg.addEventListener('pointerdown',event=>{
    if(event.button!==0||drag)return;
    interact();drag={id:event.pointerId,x:event.clientX,y:event.clientY,rotation:projection.rotate(),sensitivity:400/Math.max(1,svg.getBoundingClientRect().width)*.32*globeScale.base/projection.scale()};
    svg.setPointerCapture(event.pointerId);svg.focus({preventScroll:true});scene.dataset.dragging='true';draw();
  });
  svg.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.id)return;
    projection.rotate(rotateGlobe(drag.rotation,(event.clientX-drag.x)*drag.sensitivity,(event.clientY-drag.y)*drag.sensitivity));draw();
  });
  function endDrag(event){if(!drag||event.pointerId!==drag.id)return;drag=null;scene.dataset.dragging='false';if(svg.hasPointerCapture(event.pointerId))svg.releasePointerCapture(event.pointerId);}
  svg.addEventListener('pointerup',endDrag);svg.addEventListener('pointercancel',endDrag);svg.addEventListener('lostpointercapture',endDrag);
  svg.addEventListener('keydown',event=>{
    const arrows={ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,-8],ArrowDown:[0,8]};
    if(arrows[event.key]){event.preventDefault();interact();projection.rotate(rotateGlobe(projection.rotate(),...arrows[event.key]));draw();}
    else if(['+','=','-','_','Home'].includes(event.key)){event.preventDefault();if(event.key==='Home')reset();else zoom(['+','='].includes(event.key)?1.15:1/1.15);}
  });
  draw();
  document.addEventListener('visibilitychange',()=>{if(document.hidden)finish();});
  return {
    show(station,status){
      if(!station)return;
      if(current?.id!==station.id){cancel();clearFlag();current=station;started=false;location=null;pinReady=false;manualView=false;$('globe-pin').setAttribute('visibility','hidden');$('globe-location').textContent='Waiting for the station to start';$('globe-coordinate').textContent='Station location will appear when playback starts';draw();}
      scene.dataset.selected='true';scene.dataset.playback=status;
      $('globe-station').textContent=station.name;
      $('globe-badge').textContent=status==='playing'?'NOW PLAYING':status==='loading'?'CONNECTING':status==='paused'?'PAUSED':'PLAYBACK STOPPED';
      if(status==='playing')showFlag(station);
      if(status==='error'||status==='blocked'){cancel();started=false;}
      if(status==='playing'&&!started){
        started=true;$('globe-location').textContent='Finding station location…';
        const bounds=scene.getBoundingClientRect?.();
        if(bounds&&(bounds.top<0||bounds.bottom>window.innerHeight))scene.scrollIntoView({behavior:motionEnabled()?'smooth':'auto',block:'center'});
        void focus(station);
      }
    },
    motionChanged(){if(!motionEnabled())finish();}
  };
}
