import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.123.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.123.0/examples/jsm/controls/OrbitControls.js";
import { TWEEN } from "https://cdn.jsdelivr.net/npm/three@0.123.0/examples/jsm/libs/tween.module.min.js";

let scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 1, 100);
camera.position.set(-5, 10, 20);
let renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const textureCube = generateCubeMap();

let controls = new OrbitControls(camera, renderer.domElement);
controls.enableZoom = false;
controls.enablePan = false;
controls.enableKeys = false;
controls.enableDamping = true;

let square = new THREE.GridHelper(20, 1, 0xaaaaff, 0xaaaff);
square.position.y = 0.01;
scene.add(square);

let grid = new THREE.GridHelper(20, 10, "magenta", "magenta");
console.log(grid.geometry.attributes.position.count);
let moveable = [];
for(let i = 0; i < grid.geometry.attributes.position.count / 4; i++){
  moveable.push(1, 1, 0, 0);
}
console.log(moveable.length)
grid.geometry.setAttribute("moveable", new THREE.Float32BufferAttribute(moveable, 1));
let uniforms = {
  time: {value: 0},
  speed: {value: 1},
  size: {value: 20}
}
grid.material.onBeforeCompile = shader => {
  shader.uniforms.time = uniforms.time;
  shader.uniforms.speed = uniforms.speed;
  shader.uniforms.size = uniforms.size;
  shader.vertexShader = `
    uniform float time;
    uniform float speed;
    uniform float size;
    attribute float moveable;
    ${shader.vertexShader}
  `.replace(
    `#include <begin_vertex>`,
    `#include <begin_vertex>
        
        if (floor(moveable + 0.1) > 0.5){
          float start = size * -0.5;
          float zPos = mod( (position.z - start) + (time * speed), size) + start;
          transformed.z = zPos;
        }
    `
  );
  console.log(shader.vertexShader)
}
scene.add(grid);

// palm
let base = new THREE.Object3D();

let baseSpline = new THREE.CatmullRomCurve3([
  new THREE.Vector2(),
  new THREE.Vector2(3, 0),
  new THREE.Vector2(2.5, -7),
  new THREE.Vector2(-4, -6),
  new THREE.Vector2(-4.8, 0)
], true, "catmullrom", 0.1);
let baseG = new THREE.ExtrudeBufferGeometry(new THREE.Shape(baseSpline.getPoints(50)), {depth: 0.2, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.2});
let baseObject = new THREE.Mesh(baseG, new THREE.MeshBasicMaterial({color: "magenta", wireframe: false, envMap: textureCube}));
base.add(baseObject);
scene.add(base);
let phalanxes = [];
let f1 = createFinger(new THREE.Object3D(), 0.8, false);   // pinky
let f2 = createFinger(new THREE.Object3D(), 0.95, false);  // ring
let f3 = createFinger(new THREE.Object3D(), 1, false);     // middle
let f4 = createFinger(new THREE.Object3D(), 0.95, false);  // index
let f5Base = new THREE.Object3D();
let f5 = createFinger(new THREE.Object3D(), 0.75, true);  // thumb
f5Base.add(f5);
base.add(f1, f2, f3, f4, f5Base);

f1.position.set( -4, 0.2, 0);
f2.position.set( -2, 0.2, 0);
f3.position.set(  0, 0.2, 0);
f4.position.set(  2, 0.2, 0);
f5Base.position.set(  3, -3, 0);
f5Base.rotation.set( 0, 0, THREE.MathUtils.degToRad(-60));
f5Base.updateMatrixWorld();

let g = createPhalanxGeom(1, 3);
let m = new THREE.MeshBasicMaterial({color: "aqua", wireframe: false, envMap: textureCube});
let o = new THREE.InstancedMesh(g, m, phalanxes.length);
phalanxes.forEach( (ph, i) => {
  ph.updateMatrixWorld();
  o.setMatrixAt(i, ph.matrixWorld);
})
scene.add(o);

window.addEventListener( 'resize', onWindowResize, false );

let t = new TWEEN.Tween({value: Math.PI * 0.075})
  .to({value: Math.PI * 0.45}, 4000)
  .easing(TWEEN.Easing.Quadratic.InOut)
  .repeat(Infinity)
  .yoyo(true)
  .onUpdate(val => {
    phalanxes.forEach((ph, i) => {
      ph.rotation.x = val.value;
      ph.updateMatrixWorld();
      o.setMatrixAt(i, ph.matrixWorld)
    });
    o.instanceMatrix.needsUpdate = true;
  });
t.start();

let clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  controls.update();
  let t = clock.getElapsedTime();
  TWEEN.update();
  uniforms.time.value = t;
  base.rotation.x = (Math.sin(t * 0.125) * 0.5 + 0.5) * -Math.PI * 0.5;
  base.rotation.y = -t * 0.125;
  renderer.render(scene, camera);
});

function onWindowResize() {

  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize( innerWidth, innerHeight );

}

function createFinger(phalanx, scale, isThumb){
  phalanxes.push(phalanx);
  let current = phalanx;
  for(let i = 0; i < (isThumb ? 1 : 2); i++){
    let p = new THREE.Object3D();
    p.position.y = 3;
    p.scale.setScalar(0.85);
    current.add(p);
    phalanxes.push(p);
    current = p;
  }
  phalanx.scale.setScalar(scale);
  return phalanx;
}

function createPhalanxGeom(R, L){
  
  let r = R * 0.85;
  let R1 = R - r;
  let a = Math.asin(R1 / L);

  let path = new THREE.Path();
  path.absarc(0, 0, R, Math.PI * 1.5, a);
  path.absarc(0, L, r, a, Math.PI * 0.5);
  
  let pts = path.getPoints(5);
  
  let g = new THREE.LatheBufferGeometry(pts);
  
  return g;
}

function generateCubeMap(){
	
  
  let images = [];
  
  let c = document.createElement("canvas");
  c.width = 4;
  c.height = c.width;
  let ctx = c.getContext("2d");
  for(let i= 0; i < 6;i++){
  	ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);

    for(let j = 0; j < (c.width * c.height) / 2; j++){
      ctx.fillStyle = Math.random() < 0.5 ? "#f0f" : "#40f";
      ctx.fillRect(
        Math.floor(Math.random() * c.width),
        Math.floor(Math.random() * c.height),
        2,
        1
      );
    }
    
    images.push(c.toDataURL());
    
  }
  
  let cm = new THREE.CubeTextureLoader().load(images);
  
  console.log(cm);
  
  return cm;
}