import * as THREE from "three";
import { BoxGeometry, CylinderBufferGeometry, Vector2 } from "three";
import * as STBLIB from "three-stdlib";
import { mergeBufferAttributes, mergeBufferGeometries } from "three-stdlib";

const scene = new THREE.Scene();
scene.background = new THREE.Color("#FFEECC");

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 50);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.physicallyCorrectLights = true;
document.body.appendChild(renderer.domElement);

const controls = new STBLIB.OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.damagingFactor = 0.05;
controls.enableDamping = true;

let envmap;

(async function () {
  let pmrem = new THREE.PMREMGenerator(renderer);
  let envmapTexture = await new STBLIB.RGBELoader()
    .setDataType(THREE.FloatType)
    .loadAsync("/envmap.hdr");
  envmap = pmrem.fromEquirectangular(envmapTexture).texture;

  for (let i = -10; i <= 20; i++) {
    for (let j = -10; j <= 20; j++) {
      let position = tileToPosition(i, j);
      if (position.length() > 16) continue;
      makeHex(3, position);
    }
  }

  let hexagonMesh = new THREE.Mesh(
    hexagonGeometries,
    new THREE.MeshStandardMaterial({
      envMap: envmap,
      flatShading: true,
    })
  );
  scene.add(hexagonMesh);

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });
})();

function tileToPosition(tileX, tileY) {
  return new Vector2((tileX + (tileY % 2) * 0.5) * 1.77, tileY * 1.535);
}

let hexagonGeometries = new THREE.BoxGeometry(0, 0, 0);

function hexGeometry(height, position) {
  let geo = new THREE.CylinderGeometry(1, 1, height, 6, 1, false);
  geo.translate(position.x, height * 0.5, position.y);
  return geo;
}

function makeHex(height, position) {
  let geo = hexGeometry(height, position);
  hexagonGeometries = mergeBufferGeometries([hexagonGeometries, geo]);
}
