import * as T from 'three';
import {clamp,TIMING,strikeWind} from './engine.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {attackMotion} from './motion.js';
import {attackPassProgress,attackTravel} from './footwork.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
function mat(color,roughness=.8,metalness=0){return new T.MeshStandardMaterial({color,roughness,metalness});}
function toonMat(color,roughness=.62,metalness=.05){return new T.MeshStandardMaterial({color,roughness,metalness});}
function wovenMat(color,seed=1){
  const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
  x.fillStyle=color;x.fillRect(0,0,256,256);
  // A deliberately fine weave: it reads as textile at close range without
  // becoming a graphic pattern when the camera pulls back during a match.
  let n=seed*7919;const rand=()=>{n=(n*16807)%2147483647;return(n-1)/2147483646;};
  for(let i=-256;i<512;i+=5){x.strokeStyle=`rgba(240,242,235,${.025+rand()*.035})`;x.lineWidth=1;x.beginPath();x.moveTo(i,0);x.lineTo(i+256,256);x.stroke();}
  for(let i=0;i<256;i+=4){x.strokeStyle=`rgba(0,0,0,${.035+rand()*.045})`;x.lineWidth=1;x.beginPath();x.moveTo(0,i);x.lineTo(256,i);x.stroke();}
  const map=new T.CanvasTexture(c);map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(7,7);map.colorSpace=T.SRGBColorSpace;
  return new T.MeshStandardMaterial({color:'#ffffff',map,bumpMap:map,bumpScale:.012,roughness:.83,metalness:0});
}
function lacquerMat(color){return new T.MeshPhysicalMaterial({color,roughness:.24,metalness:.13,clearcoat:.62,clearcoatRoughness:.2});}
function mesh(geo,material,parent,x=0,y=0,z=0){const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function box(parent,w,h,d,m,x=0,y=0,z=0){return mesh(new T.BoxGeometry(w,h,d),m,parent,x,y,z);}
function ellipsoid(parent,r,s,m,x,y,z){const o=mesh(new T.SphereGeometry(r,24,16),m,parent,x,y,z);o.scale.set(...s);return o;}
function rod(parent,r,m){return mesh(new T.CylinderGeometry(r,r,1,12),m,parent);}
function between(obj,a,b){obj.position.copy(a).add(b).multiplyScalar(.5);obj.scale.y=a.distanceTo(b);obj.quaternion.setFromUnitVectors(V(0,1,0),b.clone().sub(a).normalize());}
function curve(parent,points,r,m){return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),24,r,6,false),m,parent);}
function batchStatic(parent,exclude=new Set()){
  const batches=new Map();
  for(const child of [...parent.children])if(child.isMesh&&!exclude.has(child)){
    child.updateMatrix();const geometry=child.geometry.clone().applyMatrix4(child.matrix);
    if(!batches.has(child.material))batches.set(child.material,[]);
    batches.get(child.material).push(geometry);parent.remove(child);child.geometry.dispose();
  }
  for(const [material,geometries] of batches){const geometry=mergeGeometries(geometries,false);if(geometry){const merged=mesh(geometry,material,parent);if(material.transparent)merged.castShadow=false;}for(const g of geometries)g.dispose();}
}
function clothGeometry(topR,bottomR,h,segments=36){
  const positions=[],colors=[],indices=[];
  for(let row=0;row<=8;row++)for(let i=0;i<=segments;i++){
    const t=row/8,a=i/segments*Math.PI*2;
    const pleat=Math.cos(a*12),r=mix(topR,bottomR,t)*(1+pleat*.095*t);
    const shade=1-(1-pleat)*.09*t;
    positions.push(Math.sin(a)*r,-t*h,Math.cos(a)*r*.74);
    colors.push(shade,shade,shade);
  }
  for(let row=0;row<8;row++)for(let i=0;i<segments;i++){const a=row*(segments+1)+i,b=a+segments+1;indices.push(a,b,a+1,b,b+1,a+1);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function woodTexture(){
  const c=document.createElement('canvas');c.width=512;c.height=1024;const x=c.getContext('2d');
  let seed=187;const rand=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  // Eight narrow boards per tile, with staggered end joints. The older
  // texture had one nearly metre-wide plank per repeat and read as stripes.
  for(let board=0;board<8;board++){
    const left=board*64,light=Math.floor(rand()*13)-6;
    x.fillStyle=`rgb(${160+light},${128+light},${88+light})`;
    x.fillRect(left,0,64,1024);
    for(let grain=0;grain<95;grain++){
      const u=left+rand()*64,wave=rand()*6,bright=rand()>.46;
      x.strokeStyle=`rgba(${bright?'242,218,171':'74,53,34'},${.025+rand()*.065})`;
      x.lineWidth=.35+rand()*.8;x.beginPath();
      for(let y=0;y<=1024;y+=32){const px=u+Math.sin(y*.017+grain)*wave*.27;if(y===0)x.moveTo(px,y);else x.lineTo(px,y);}
      x.stroke();
    }
    x.fillStyle='rgba(51,39,29,.28)';x.fillRect(left,0,1.5,1024);
    x.fillStyle='rgba(248,225,177,.12)';x.fillRect(left+2,0,1,1024);
    const joint=board%2===0?512:256;
    for(let y=joint;y<1024;y+=512){
      x.fillStyle='rgba(60,44,30,.24)';x.fillRect(left+1,y,63,2);
      x.fillStyle='rgba(239,211,158,.10)';x.fillRect(left+1,y+2,63,1);
    }
  }
  const tex=new T.CanvasTexture(c);tex.wrapS=tex.wrapT=T.RepeatWrapping;
  tex.repeat.set(16,4);tex.colorSpace=T.SRGBColorSpace;return tex;
}
function tareNameTexture(name){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=512;
  const ctx=canvas.getContext('2d');
  const letters=Array.from(String(name||'정진').trim()).slice(-4);
  ctx.fillStyle='#f4f1e8';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font=`bold ${letters.length>3?93:112}px "Malgun Gothic", "Noto Sans KR", sans-serif`;
  const step=letters.length>3?104:128,start=256-(letters.length-1)*step/2;
  letters.forEach((letter,i)=>ctx.fillText(letter,128,start+i*step));
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  return texture;
}
export class Dojo {
  constructor(canvas){
    this.canvas=canvas;this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    // Sharper desktop output while retaining a conservative pixel budget on
    // phones: this is visual fidelity, not a change to simulation timing.
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia('(pointer:coarse)').matches?1.35:2));this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
    this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.06;
    this.scene=new T.Scene();this.scene.background=new T.Color('#647776');this.scene.fog=new T.Fog('#647776',17,37);
    this.camera=new T.PerspectiveCamera(36,1,.1,65);this.camera.position.set(6.7,3.4,8.6);this.target=V(0,1,0);this.view=0;this.shake=0;this.hitTime=0;
    this.highlightState=null;this.scene.add(new T.HemisphereLight('#dce7df','#54402b',2.1));
    const sun=new T.DirectionalLight('#ffe2ae',4.1);sun.position.set(-5,9,-5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:.5,far:25});sun.shadow.normalBias=.025;sun.shadow.bias=-.0003;sun.shadow.radius=3;this.scene.add(sun);
    const fill=new T.DirectionalLight('#badde9',1.0);fill.position.set(4,4,7);this.scene.add(fill);
    this.buildDojo();batchStatic(this.scene);this.player=new Fighter(this.scene,'blue');this.ai=new Fighter(this.scene,'white');this.buildReferees();
    this.effects=[];this.pendingImpacts=[];this.makeDust();
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas.parentElement);this.resize();
  }
  resize(){const r=this.canvas.getBoundingClientRect();this.width=r.width;this.height=r.height;this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();}
  buildDojo(){
    const s=this.scene,wood=mat('#5c4530'),dark=mat('#2b3832'),wall=mat('#909b89'),paper=mat('#d6d7b5');
    const floor=mat('#ffffff',.57);floor.map=woodTexture();floor.map.anisotropy=this.renderer.capabilities.getMaxAnisotropy();box(s,24,.15,20,floor,0,-.1,0);
    box(s,24,7,.25,wall,0,3.4,-6);box(s,.25,7,20,wall,-10,3.4,0);
    box(s,24,1,.2,dark,0,.42,-5.8);
    for(let x=-10;x<=10;x+=3.3){box(s,.18,6.2,.28,wood,x,3,-5.55);box(s,.23,.2,18,wood,x,6,0);}
    for(const y of [1.1,4.3,5.8])box(s,24,.18,.3,wood,0,y,-5.6);
    const glass=new T.MeshStandardMaterial({color:'#cedace',emissive:'#c8d5b2',emissiveIntensity:.33,roughness:.85});
    for(let x=-8.3;x<9;x+=3.3){
      box(s,2.9,2.8,.12,glass,x,2.7,-5.7);
      for(let q=-1.3;q<=1.4;q+=.44)box(s,.04,2.8,.18,wood,x+q,2.7,-5.55);
      for(let y=1.35;y<4.1;y+=.55)box(s,2.9,.035,.18,wood,x,y,-5.53);
    }
    // Pale window projections on the timber floor.
    const lightmat=new T.MeshBasicMaterial({color:'#f4e2ad',transparent:true,opacity:.095,depthWrite:false,side:T.DoubleSide});
    for(let x=-8;x<9;x+=3.3){const g=new T.Group();g.position.set(x,.006,-2.8);g.rotation.y=-.34;s.add(g);for(let i=0;i<5;i++)box(g,.38,.001,4.8,lightmat,i*.48,0,0);}
    for(let x=-9;x<=9;x+=3){box(s,.12,.16,17,dark,x,5.6,0);}
    // Calligraphy scroll is a texture on a physical cloth panel, not an overlay.
    const c=document.createElement('canvas');c.width=256;c.height=768;const ctx=c.getContext('2d');ctx.fillStyle='#d7d0b0';ctx.fillRect(0,0,256,768);ctx.fillStyle='#26332d';ctx.textAlign='center';ctx.font='135px serif';ctx.fillText('正',128,230);ctx.fillText('進',128,405);ctx.font='20px serif';ctx.fillText('日 々 是 稽 古',128,590);ctx.fillStyle='#9e4d38';ctx.fillRect(162,630,38,43);ctx.fillStyle='#ddc9a0';ctx.font='26px serif';ctx.fillText('心',181,662);
    const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;const scrollMat=mat('#ffffff');scrollMat.map=map;
    box(s,1.25,3.6,.08,dark,0,3,-5.3);box(s,1.05,3.2,.1,scrollMat,0,3,-5.2);
    for(const y of [1.38,4.62]){const r=rod(s,.045,wood);between(r,V(-.65,y,-5.12),V(.65,y,-5.12));}
    // Keep the wooden dojo while borrowing the real tournament floor layout:
    // a broad blue waiting/walking lane sits outside the white match boundary.
    const lane=mat('#3867ad',.94);
    for(const x of [-7.04,7.04])box(s,1.0,.014,9.08,lane,x,-.012,0);
    for(const z of [-4.04,4.04])box(s,15.08,.014,1.0,lane,0,-.012,z);
    const tape=new T.MeshStandardMaterial({color:'#f4f1e9',roughness:1,transparent:true,opacity:.9});
    for(const x of [-6.5,6.5])box(s,.075,.004,7,tape,x,.004,0);
    for(const z of [-3.5,3.5])box(s,13,.004,.075,tape,0,.004,z);
    box(s,.48,.004,.035,tape,0,.005,0);box(s,.035,.004,.48,tape,0,.005,0);
    for(const x of [-2.15,2.15])box(s,.035,.004,.4,tape,x,.005,0);
    // Equipment bench and stored shinai give the empty hall a lived-in scale.
    box(s,3,.16,.7,wood,6,.48,-4.5);for(const x of [4.8,7.2])box(s,.12,.45,.5,dark,x,.2,-4.5);
    const bamboo=mat('#c3a06d');for(let i=0;i<5;i++){const stick=rod(s,.018,bamboo);between(stick,V(5.1+i*.2,.6,-4.5),V(5.3+i*.2,2,-4.9));}
  }
  buildReferees(){
    this.referees=[];
    const shirt=mat('#ecece7'),shirtShade=mat('#d9ddd8'),trousers=mat('#4a4d50'),red=mat('#aa4d3b'),white=mat('#eee9d5'),stick=mat('#93754d'),belt=mat('#202529'),socks=mat('#15191b'),collar=mat('#c8cdc7'),button=mat('#8f9693');
    // 두 부심과 주심은 같은 복장을 입되 체격, 얼굴, 머리 모양이 서로
    // 다르다. 구형 머리+원통 몸통 대신 성인 비율의 목·어깨·허리·관절을 쓴다.
    const profiles=[
      {x:-3.65,z:-1.9,angle:.65,build:.96,height:1.13,shoulder:.214,waist:.172,stance:.105,skin:'#c69f82',hair:'#202725',style:'crop'},
      {x:3.65,z:-1.9,angle:-.65,build:1.03,height:1.10,shoulder:.224,waist:.188,stance:.12,skin:'#b8896e',hair:'#302923',style:'part'},
      {x:0,z:3.15,angle:Math.PI,build:1.00,height:1.16,shoulder:.219,waist:.18,stance:.115,skin:'#c39a7d',hair:'#555b59',style:'swept'}
    ];
    for(const p of profiles){
      const skin=mat(p.skin),hair=mat(p.hair);
      const root=new T.Group();root.position.set(p.x,0,p.z);root.rotation.y=p.angle;root.scale.set(p.build,p.height,p.build);this.scene.add(root);
      // Two-piece legs expose a knee and a natural stance instead of one
      // straight peg.  Each referee also has a different stance width.
      for(const sign of [-1,1]){
        const hip=V(sign*p.stance,.98,0),knee=V(sign*(p.stance+.014),.54,.018),ankle=V(sign*(p.stance+.005),.105,.035);
        const thigh=rod(root,.085,trousers);between(thigh,hip,knee);
        ellipsoid(root,.086,[.92,.78,.80],trousers,...knee.toArray());
        const shin=rod(root,.068,trousers);between(shin,knee,ankle);
        // A narrow black sock remains visible between the trouser hem and shoe.
        const sock=rod(root,.059,socks);between(sock,V(ankle.x,.16,.035),V(ankle.x,.07,.045));
        box(root,.15,.062,.31,belt,ankle.x,.045,.105);
      }
      box(root,p.stance*2+.19,.17,.25,trousers,0,.96,0);box(root,p.stance*2+.20,.052,.25,belt,0,1.025,0);
      // Taper the shoulder plane into the neck instead of ending the shirt
      // in a wide, flat ring behind the head.
      const torsoPoints=[[p.waist,0],[p.waist+.008,.12],[p.waist+.025,.31],[p.shoulder-.014,.49],[p.shoulder-.015,.55],[p.shoulder-.035,.58],[.095,.615],[.072,.65]];
      const torso=mesh(new T.LatheGeometry(torsoPoints.map(q=>new T.Vector2(...q)),24),shirt,root,0,1.00,0);torso.scale.z=.76;
      // Collar, tie and neck make the white-shirt uniform readable at distance.
      const neck=rod(root,.066,skin);between(neck,V(0,1.62,0),V(0,1.735,0));
      box(root,.165,.038,.14,collar,0,1.59,.055);box(root,.031,.30,.014,red,0,1.37,.166);box(root,.041,.09,.016,red,0,1.52,.168);
      // A narrow placket, buttons and shoulder seams make the shirt read as
      // tailored fabric rather than a single toy-like cone.
      box(root,.012,.47,.009,shirtShade,0,1.31,.174);
      for(const y of [1.18,1.29,1.40,1.51])ellipsoid(root,.010,[.7,.7,.38],button,0,y,.181);
      // Smaller, vertically proportioned face with ears and a subtle nose.
      ellipsoid(root,.118,[.82,1.25,.88],skin,0,1.84,0);
      ellipsoid(root,.030,[.36,.56,.62],skin,0,1.83,.108);
      for(const sign of [-1,1])ellipsoid(root,.029,[.40,.72,.34],skin,sign*.102,1.84,0);
      if(p.style==='crop'){
        // 부심 1: 두피에 붙는 짧은 스포츠머리.
        ellipsoid(root,.120,[.86,.34,.91],hair,0,1.947,-.010);
        box(root,.020,.095,.115,hair,-.092,1.91,-.018);
      }else if(p.style==='part'){
        // 부심 2: 높이와 앞머리가 분명한 검은 옆가르마.
        ellipsoid(root,.122,[.90,.47,.94],hair,0,1.952,-.012);
        ellipsoid(root,.070,[.95,.42,.62],hair,-.055,1.938,.073);
        box(root,.018,.105,.105,hair,.098,1.91,-.015);
      }else{
        // 주심: 정수리를 완전히 덮는 단정한 중년형 옆가르마. 회색은
        // 색조로만 구분하고, 탈모처럼 보이는 빈 공간은 만들지 않는다.
        ellipsoid(root,.121,[.88,.43,.93],hair,0,1.948,-.012);
        ellipsoid(root,.066,[.90,.34,.54],hair,-.050,1.957,.070);
        box(root,.016,.095,.103,hair,.096,1.91,-.018);
      }
      // 관중 화면에서는 세 심판 모두 좌백·우홍으로 읽힌다. 주심과 마주 보는
      // 양쪽 부심은 그 결과를 맞추기 위해 주심과 반대 손에 각 색을 든다.
      const flags={};
      const redSign=Math.abs(p.x)<.1?-1:1;
      for(const [name,sign,color] of [['red',redSign,red],['white',-redSign,white]]){
        const arm=new T.Group();arm.position.set(sign*(p.shoulder-.012),1.54,0);root.add(arm);
        const elbow=V(sign*.065,-.285,.035),hand=V(sign*.018,-.535,.115);
        // Start the sleeve inside the shirt's shoulder rather than at its
        // outside edge. This closes the visible slit without adding a round
        // shoulder pad or changing the flag arm's pivot.
        const sleeve=mesh(new T.CylinderGeometry(.060,.055,1,12),shirt,arm);
        between(sleeve,V(-sign*.055,.045,-.035),elbow);
        ellipsoid(arm,.052,[.88,.90,.82],skin,...elbow.toArray());
        const forearm=rod(arm,.043,skin);between(forearm,elbow,hand);
        ellipsoid(arm,.047,[.88,1.08,.84],skin,...hand.toArray());
        const pole=rod(arm,.009,stick);between(pole,hand,V(hand.x+sign*.022,-.96,.115));
        box(arm,.23,.25,.008,color,hand.x+.1,-.82,.115);flags[name]=arm;
      }
      batchStatic(root);this.referees.push(flags);
    }
  }
  setNames(player,opponent){this.player.setName(player);this.ai.setName(opponent);}
  makeDust(){
    const positions=[];for(let i=0;i<110;i++)positions.push((Math.random()-.5)*18,Math.random()*5,(Math.random()-.5)*12);
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    this.dust=new T.Points(g,new T.PointsMaterial({color:'#efddb0',size:.018,transparent:true,opacity:.35,depthWrite:false}));this.scene.add(this.dust);
  }
  impact(player,zone){
    // The rules engine confirms the point just before the rendered wrists have
    // fully reached the contact key.  Queue the particles for two visual
    // frames so the target is actually struck before the hit flash appears.
    this.pendingImpacts.push({player,zone,delay:.034});
  }
  spawnImpact(player,zone){
    this.shake=.055;this.hitTime=.11;
    const pos=(player?this.ai:this.player).root.position.clone();pos.y=zone==='men'?1.99:zone==='kote'?1.3:1.15;
    for(let i=0;i<16;i++){const crimson=i%4===0?'#a51f29':i%4===1?'#d53c3f':i%2?'#eed7a4':'#fbf5d8';const m=mesh(new T.SphereGeometry(i%4===0?.022:.012,5,4),new T.MeshBasicMaterial({color:crimson,transparent:true}),this.scene,...pos.toArray());this.effects.push({mesh:m,v:V((Math.random()-.5)*2,Math.random()*1.5,(Math.random()-.5)*2),life:i%4===0?.62:.35});}
  }
  highlight(point){
    if(!point)return;this.highlightState={...point,elapsed:0,life:3.3,impactPlayed:false};
  }
  render(match,dt,active=true){
    let playerState=match.player,aiState=match.ai,replayFocus=null;
    if(this.highlightState){
      const h=this.highlightState;h.elapsed+=dt*.32;h.life-=dt;
      const actor=h.player?{...match.player}:{...match.ai};const defender=h.player?{...match.ai}:{...match.player};
      const wind=strikeWind(h.zone,h.player,match.level),travel=attackTravel(h.elapsed,wind,h.zone);
      actor.x=(h.startX??actor.x)+(h.player?1:-1)*travel;actor.state='attack';actor.zone=h.zone;actor.elapsed=h.elapsed;actor.velocity=0;
      defender.x=h.opponentX??defender.x;defender.state='idle';defender.velocity=0;
      if(h.player){playerState=actor;aiState=defender;}else{aiState=actor;playerState=defender;}
      replayFocus=V(defender.x,h.zone==='men'?1.85:h.zone==='kote'?1.28:1.12,0);
      if(!h.impactPlayed&&h.elapsed>=wind){h.impactPlayed=true;this.pendingImpacts.push({player:h.player,zone:h.zone,delay:0});}
      if(h.life<=0)this.highlightState=null;
    }
    this.player.update(playerState,match.clock,dt,true,match.level,match.pointWait,match.stance);
    this.ai.update(aiState,match.clock,dt,false,match.level,match.pointWait,'chudan');
    for(let i=this.pendingImpacts.length-1;i>=0;i--){const p=this.pendingImpacts[i];p.delay-=dt;if(p.delay<=0){this.spawnImpact(p.player,p.zone);this.pendingImpacts.splice(i,1);}}
    // Raised flags finish vertically overhead instead of at a diagonal.
    for(const ref of this.referees){const sign=match.pointWait>0?(match.player.state==='hit'?-1:1):0;ref.red.rotation.z=mix(ref.red.rotation.z,sign===1?Math.PI:0,1-Math.exp(-dt*11));ref.white.rotation.z=mix(ref.white.rotation.z,sign===-1?-Math.PI:0,1-Math.exp(-dt*11));}
    const center=(match.player.x+match.ai.x)/2;
    const narrow=this.width/this.height<1;
    const poses=narrow?[V(1.0,4.1,12.8),V(.5,5.8,15),V(9,4.5,11),V(-9,4.5,11)]:[V(.7,3.5,9.5),V(2.8,2.85,8.5),V(7,2.5,6.4),V(-7,2.5,6.4)];
    const dest=replayFocus?replayFocus.clone().add(narrow?V(2.8,1.25,5.1):V(3.6,1.05,4.5)):poses[this.view].clone();if(!replayFocus)dest.x+=center*.4;
    this.camera.position.lerp(dest,1-Math.exp(-dt*(replayFocus?5:3)));this.target.lerp(replayFocus||V(center*.5,narrow?1.08:1.13,0),1-Math.exp(-dt*(replayFocus?6:4)));
    const target=this.target.clone();if(this.shake>0){target.x+=Math.sin(match.clock*150)*this.shake;target.y+=Math.cos(match.clock*123)*this.shake;this.shake=Math.max(0,this.shake-dt*.4);}
    this.camera.lookAt(target);if(active)this.dust.rotation.y+=dt*.008;
    for(let i=this.effects.length-1;i>=0;i--){const e=this.effects[i];e.life-=dt;e.mesh.position.addScaledVector(e.v,dt);e.v.y-=dt*3;e.mesh.material.opacity=Math.max(0,e.life/.35);if(e.life<=0){this.scene.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();this.effects.splice(i,1);}}
    this.renderer.render(this.scene,this.camera);
  }
}
class Fighter {
  constructor(scene,side){
    this.root=new T.Group();scene.add(this.root);this.side=side;
    // Adult competitive build: the model is scaled from the sole, so height grows without floating above the floor.
    // A competitive adult build: raise height from the sole and broaden the
    // silhouette together, rather than making the helmet look oversized.
    // 선수는 주심보다 약 15cm만 크게: 기준 체형의 1.1배 세로 비율.
    this.root.scale.set(1.06,1.276,1.06);
    // Material separation is what makes the existing animated geometry read
    // more like real equipment: woven cloth, matte leather, lacquer and steel
    // now respond differently to the same dojo light.
    const blue=side==='blue';this.fabric=wovenMat(blue?'#172b49':'#ece9dd',blue?7:13);this.hakamaFabric=this.fabric.clone();this.hakamaFabric.vertexColors=true;this.fold=wovenMat(blue?'#13243d':'#d0d4cf',blue?17:23);this.armor=lacquerMat('#111b23');this.trim=lacquerMat('#4a5b61');this.skin=toonMat('#c5a284',.7);this.tape=toonMat(blue?'#c94140':'#ebe6cd',.58);this.metal=new T.MeshPhysicalMaterial({color:'#c1c9c3',roughness:.2,metalness:.88,clearcoat:.32});
    this.body=new T.Group();this.root.add(this.body);
    this.pelvis=new T.Group();this.body.add(this.pelvis);this.pelvis.position.y=1.04;
    this.trousers=[];
    for(const x of [-.125,.125])this.trousers.push(mesh(clothGeometry(.135,.205,.96),this.hakamaFabric,this.pelvis,x,0,0));
    const torsoGeo=new T.LatheGeometry([[.165,0],[.18,.1],[.23,.36],[.255,.49],[.19,.57],[.115,.6]].map(p=>new T.Vector2(...p)),24);
    this.torso=mesh(torsoGeo,this.fabric,this.body,0,1.02,0);this.torso.scale.z=.76;
    // Lacquered do, rounded rather than box-shaped.
    const doGeo=new T.CylinderGeometry(.245,.205,.36,32,1,false,-Math.PI*.58,Math.PI*1.16);
    this.do=mesh(doGeo,this.armor,this.body,0,1.27,.025);this.do.scale.z=.83;
    ellipsoid(this.body,.245,[1,.44,.52],this.armor,0,1.445,.055);
    // Slim crossed do-himo on the back make the torso read as clothing and armor.
    for(const sign of [-1,1])curve(this.body,[V(sign*.19,1.53,-.06),V(sign*.1,1.34,-.18),V(-sign*.18,1.15,-.13)],.014,this.trim);
    for(let i=-2;i<=2;i++){const panel=box(this.body,.092,.29,.045,this.armor,i*.096,1.005,.16);panel.rotation.x=-.1;for(const yy of [.91,.95,.99,1.03])box(this.body,.079,.005,.006,this.trim,i*.096,yy,.19);}
    // The tare carries the competitor's name in white on a black panel.
    // Red/white identity stays on the men ribbon, never on this name space.
    box(this.body,.155,.23,.012,this.armor,0,1.0,.204);
    this.nameMaterial=new T.MeshBasicMaterial({map:tareNameTexture(blue?'수련자':'맞수'),transparent:true,depthWrite:false,side:T.DoubleSide});
    mesh(new T.PlaneGeometry(.125,.215),this.nameMaterial,this.body,0,1.0,.214);
    // A helmet shell with a dark inset, steel grille, throat flap and side wings.
    this.head=new T.Group();this.head.position.set(0,1.895,.015);this.head.scale.setScalar(.77);this.body.add(this.head);
    mesh(new T.CylinderGeometry(.078,.09,.19,16),this.fabric,this.body,0,1.68,0);
    const helmetCloth=wovenMat('#182939',31);
    ellipsoid(this.head,.255,[.85,1.09,.94],helmetCloth,0,0,0);
    ellipsoid(this.head,.218,[.83,1,.55],this.armor,0,-.005,.14);
    const rim=curve(this.head,[V(-.158,-.17,.23),V(-.185,.01,.23),V(-.125,.185,.21),V(0,.218,.21),V(.125,.185,.21),V(.185,.01,.23),V(.158,-.17,.23)],.014,this.trim);
    for(let j=0;j<9;j++){const y=-.14+j*.038,w=Math.sqrt(Math.max(0,1-(y/.225)**2))*.157;curve(this.head,[V(-w,y,.225),V(0,y,.287),V(w,y,.225)],.007,this.metal);}
    curve(this.head,[V(0,-.18,.25),V(0,0,.29),V(0,.2,.235)],.009,this.metal);
    for(const x of [-1,1]){const wing=box(this.head,.105,.29,.27,helmetCloth,x*.205,-.15,-.005);wing.rotation.z=x*.28;for(let j=0;j<5;j++)box(this.head,.009,.24,.012,this.trim,x*(.17+j*.013),-.155,.135);}
    box(this.head,.16,.22,.08,this.armor,0,-.245,.16);
    this.ribbon=box(this.head,.022,.42,.012,this.tape,.09,-.19,-.22);
    this.legs=[];for(const x of [-.14,.14]){
      // Legs and hakama share the pelvis rig, so the lower body cannot lag
      // behind a torso transition during the bow or a technique.
      const upper=rod(this.pelvis,.079,this.fabric),lower=rod(this.pelvis,.067,this.fold);
      const foot=ellipsoid(this.pelvis,.12,[.54,.32,1.45],this.skin,x,-.999,.1);
      this.legs.push({upper,lower,foot});
    }
    this.arms=[];for(const x of [-1,1]){
      const upper=rod(this.body,.079,this.fabric),lower=rod(this.body,.061,this.fabric);
      const sleeve=ellipsoid(this.body,.115,[1,1.18,1],this.fabric,x*.25,1.51,.01);
      const kote=ellipsoid(this.body,.077,[.95,1.34,1.1],this.armor,x*.25,1.3,.35);
      this.arms.push({upper,lower,sleeve,kote,side:x});
    }
    this.shinai=new T.Group();this.body.add(this.shinai);
    const bamboo=toonMat('#cbb581',.56),leather=toonMat('#ded8b8',.5);
    const stick=rod(this.shinai,.017,bamboo);between(stick,V(0,0,0),V(0,1.13,0));
    const handle=rod(this.shinai,.025,leather);between(handle,V(0,-.1,0),V(0,.22,0));
    const tsuba=mesh(new T.CylinderGeometry(.068,.068,.017,24),mat('#705438'),this.shinai,0,.225,0);
    for(const y of [.54,.96,1.125])mesh(new T.CylinderGeometry(.02,.02,.026,12),leather,this.shinai,0,y,0);
    for(let j=0;j<4;j++){const angle=j*Math.PI/2;const line=rod(this.shinai,.002,mat('#86704c'));between(line,V(Math.sin(angle)*.017,.24,Math.cos(angle)*.017),V(Math.sin(angle)*.017,1.1,Math.cos(angle)*.017));}
    this.pose={hand:V(0,1.19,.38),tip:V(0,1.64,1.42),lean:0,lunge:0,twist:0,sink:0,frontLift:0,backLift:0,frontOffset:0,backOffset:0};
    // 1.2× shinai length, while its base remains locked to both hands.
    this.shinai.scale.y=1.1;
    batchStatic(this.head,new Set([this.ribbon]));batchStatic(this.shinai);
    batchStatic(this.body,new Set(this.arms.flatMap(a=>[a.upper,a.lower,a.kote])));
  }
  setName(name){
    const old=this.nameMaterial.map;
    this.nameMaterial.map=tareNameTexture(name);
    this.nameMaterial.needsUpdate=true;
    old?.dispose();
  }
  update(f,time,dt,player,level,pointWait,stance){
    this.root.position.x=f.x;this.root.rotation.y=player?Math.PI/2:-Math.PI/2;
    const wind=strikeWind(f.zone,player,level);
    // Every committed cut exits on a lane beside the opponent instead of
    // stopping in front of them or visually passing through their body.
    const passProgress=f.state==='attack'?attackPassProgress(f.elapsed,wind):0;
    // Each finish has its own lane: a big men clears furthest, kote stays
    // compact, and waist cuts arc around the opponent rather than through it.
    const passWidth=f.zone==='men'?.92:f.zone==='smallMen'?.74:f.zone==='kote'?.58:['do','gyakuDo'].includes(f.zone)?.76:f.zone==='hikiDo'?.52:.66;
    const passTarget=(player?-1:1)*passWidth*passProgress;
    this.passOffset=mix(this.passOffset??0,passTarget,1-Math.exp(-dt*(f.state==='attack'?22:7)));
    this.root.position.z=this.passOffset;
    // 상단세는 손을 이마 위에 두고 죽도 끝을 등 뒤로 충분히 눕힌다.
    const restHand=stance==='jodan'?V(0,1.98,.04):V(0,1.19,.38),restTip=stance==='jodan'?V(0,2.68,-.95):V(0,1.64,1.42);
    let hand=restHand.clone(),tip=restTip.clone(),lean=0,lunge=0,twist=0,sink=0,frontLift=0,backLift=0,frontOffset=0,backOffset=0;
    const breath=Math.sin(time*2.7+(player?0:2))*.007;
    if(f.state==='attack'){
      ({hand,tip,lean,lunge,twist,sink,frontLift,backLift,frontOffset,backOffset}=attackMotion(f.zone,f.elapsed,wind,restHand,restTip,f.counter));
    }else if(f.state==='entry'){
      // 죽도를 든 채 입장하는 자세. 3보 뒤 짧은 인사로 이어진다.
      hand.set(0,.88,.16);tip.set(0,.56,-.37);lean=.01;
    }else if(f.state==='bow'){
      // Keep the entire rig at one height while bowing.  Applying sink here
      // moved the hip anchors twice and visually separated the torso from the legs.
      hand.set(0,.78,.16);tip.set(0,.48,-.32);lean=.31;sink=0;
    }else if(f.state==='approach'){
      hand.set(0,.94,.19);tip.set(0,.70,-.14);lean=.01;
    }else if(f.state==='draw'){
      const k=clamp(f.elapsed/.55,0,1);hand.lerp(V(0,1.19,.38),k);tip.lerp(V(0,1.64,1.42),k);lean=0;
    }else if(f.state==='clinch'){
      hand.set(0,1.34,.36);tip.set(0,1.55,.70);lean=.018;lunge=0;
    }else if(f.state==='guard'){
      if(f.guardStyle===1){hand.set(.13,1.43,.42);tip.set(-.52,1.68,.72);lean=-.018;twist=-.08;}
      else if(f.guardStyle===2){hand.set(-.16,1.28,.43);tip.set(.58,1.55,.68);lean=-.045;twist=.12;}
      else{hand.set(-.08,1.74,.4);tip.set(.72,2.18,.63);lean=-.035;}
    }else if(f.state==='seme'){
      // Seme stays upright; irimi advances from the hips and feet while the blade keeps the center line.
      const phase=time*(f.semeStyle===1?10:f.semeStyle===2?7:8);
      hand.z+=f.irimi?.16:.07;
      if(f.semeStyle===1){tip.x=Math.sin(phase)*.13;tip.y+=Math.cos(phase)*.077;tip.z+=.10;hand.x=Math.sin(phase)*.025;hand.y+=Math.cos(phase)*.010;twist=Math.sin(phase)*.045;}
      else if(f.semeStyle===2){tip.x=Math.sin(phase)*.16;tip.y+=Math.cos(phase)*.035;tip.z+=.07+Math.cos(phase)*.055;hand.x=Math.sin(phase)*.035;hand.y+=Math.cos(phase)*.007;twist=Math.sin(phase)*.075;}
      else{tip.x=Math.sin(phase)*.052;tip.y+=Math.cos(phase)*.025;tip.z+=.11;hand.y+=Math.cos(phase)*.005;}
      if(f.irimi)tip.z+=.10;
      lean=f.irimi?.008:.025;
    }else if(f.state==='hit'){
      const t=Math.exp(-f.elapsed*4);lean=-.13*t;hand.y-=t*.1;tip.y-=t*.2;
    }
    if(pointWait>0&&f.state==='attack'&&f.elapsed>wind+TIMING.recovery){hand=restHand;tip=restTip;lean=0;lunge=0;}
    const blend=1-Math.exp(-dt*(f.state==='attack'?40:16));
    this.pose.hand.lerp(hand,blend);this.pose.tip.lerp(tip,blend);this.pose.lean=mix(this.pose.lean,lean,blend);this.pose.lunge=mix(this.pose.lunge,lunge,blend);
    for(const [name,value] of Object.entries({twist,sink,frontLift,backLift,frontOffset,backOffset}))this.pose[name]=mix(this.pose[name],value,blend);
    this.body.position.y=breath+this.pose.sink;this.body.rotation.x=this.pose.lean;this.body.rotation.y=this.pose.twist;this.body.position.z=this.pose.lunge*.15;
    this.head.rotation.y=Math.sin(time*.8)*.012-this.pose.twist*.65;this.head.rotation.x=-this.pose.lean*.6;this.ribbon.rotation.x=Math.sin(time*4)*.12+this.pose.lean*2;
    const walking=f.state!=='attack'&&Math.abs(f.velocity)>.08;const gait=Math.sin(time*16)*(walking?.16:0);
    this.pelvis.rotation.z=walking?Math.sin(time*10)*.018:0;
    for(let i=0;i<2;i++){
      const leg=this.legs[i],x=i===0?-.14:.14,z=(i===0?-.2:.23)+(i===0?-gait:gait)+(i===1?this.pose.frontOffset:this.pose.backOffset);
      const lift=i===1?this.pose.frontLift:this.pose.backLift;
      leg.foot.position.set(x,-.999+Math.max(0,(i===0?-gait:gait))*.14+lift,z+.08);leg.foot.rotation.x=i===0?-this.pose.backLift*4:this.pose.frontLift;
      this.trousers[i].rotation.x=-Math.atan2(z,1.02);
      // The legs now live under `body`, so these anchors are body-local.
      // Adding sink/lunge a second time made the feet slide away whenever the
      // torso transitioned through the ceremony or an attack.
      const hip=V(x,0,0),ankle=V(x,-.94+lift,z),knee=V(x,-.49,z*.65+.06+lift*.7);
      between(leg.upper,hip,knee);between(leg.lower,knee,ankle);
    }
    const direction=this.pose.tip.clone().sub(this.pose.hand).normalize();
    this.shinai.position.copy(this.pose.hand);this.shinai.quaternion.setFromUnitVectors(V(0,1,0),direction);
    const hands=[this.pose.hand.clone(),this.pose.hand.clone().addScaledVector(direction,.19)];
    for(let i=0;i<2;i++){
      const arm=this.arms[i],shoulder=V(arm.side*.25,1.53,.005),wrist=hands[i];
      // Two-bone elbow construction keeps both gloves on the shinai throughout each blend.
      const axis=wrist.clone().sub(shoulder),d=axis.length();axis.normalize();
      const length=Math.max(.32,d*.505),height=Math.sqrt(Math.max(.002,length*length-d*d*.25));
      const bend=V(arm.side*.7,-.8,-.2);bend.addScaledVector(axis,-bend.dot(axis)).normalize();
      const elbow=shoulder.clone().lerp(wrist,.5).addScaledVector(bend,height);
      between(arm.upper,shoulder,elbow);between(arm.lower,elbow,wrist);arm.kote.position.copy(wrist);arm.kote.quaternion.copy(this.shinai.quaternion);
    }
  }
}
