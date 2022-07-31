import * as THREE from "three";
import {
  BoxGeometry,
  Color,
  CylinderBufferGeometry,
  CylinderGeometry,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PointLight,
  SphereGeometry,
  Vector2,
} from "three";
import * as STBLIB from "three-stdlib";
import { mergeBufferAttributes, mergeBufferGeometries } from "three-stdlib";
import * as SIMPLEX from "simplex-noise";

const scene = new THREE.Scene();
scene.background = new THREE.Color("#FFEECC");

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(-17, 31, 33);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.physicallyCorrectLights = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const light = new PointLight(
  new THREE.Color("#FFCB8E").convertSRGBToLinear().convertSRGBToLinear(),
  80,
  200
);
light.position.set(10, 20, 10);

light.castShadow = true;
light.shadow.mapSize.width = 512;
light.shadow.mapSize.height = 512;
light.shadow.camera.near = 0.5;
light.shadow.camera.far = 500;
scene.add(light);

const controls = new STBLIB.OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.damagingFactor = 0.05;
controls.enableDamping = true;

let envmap;
const MAX_HEIGHT = 10;
const STONE_HEIGHT = MAX_HEIGHT * 0.8;
const DIRT_HEIGHT = MAX_HEIGHT * 0.7;
const GRASS_HEIGHT = MAX_HEIGHT * 0.5;
const SAND_HEIGHT = MAX_HEIGHT * 0.3;
const DIRT2_HEIGHT = MAX_HEIGHT * 0;

(async function () {
  let pmrem = new THREE.PMREMGenerator(renderer);
  let envmapTexture = await new STBLIB.RGBELoader()
    .setDataType(THREE.FloatType)
    .loadAsync("/envmap.hdr");
  envmap = pmrem.fromEquirectangular(envmapTexture).texture;

  let textures = {
    dirt: await new THREE.TextureLoader().loadAsync("/dirt.png"),
    dirt2: await new THREE.TextureLoader().loadAsync("/dirt2.jpg"),
    grass: await new THREE.TextureLoader().loadAsync("/grass.jpg"),
    sand: await new THREE.TextureLoader().loadAsync("/sand.jpg"),
    water: await new THREE.TextureLoader().loadAsync("/water.jpg"),
    stone: await new THREE.TextureLoader().loadAsync("/stone.png"),
  };

  let seaMesh = new THREE.Mesh(
    new CylinderGeometry(17, 17, MAX_HEIGHT * 0.2, 50),
    new MeshPhysicalMaterial({
      envMap: envmap,
      color: new Color("#55aaff").convertSRGBToLinear().multiplyScalar(3),
      ior: 1.4,
      transmission: 1,
      transparent: true,
      thickness: 1.5,
      envMapIntensity: 0.2,
      roughness: 1,
      metalness: 0.025,
      roughnessMap: textures.water,
      metalnessMap: textures.water,
    })
  );
  seaMesh.receiveShadow = true;
  seaMesh.position.set(0, MAX_HEIGHT * 0.1, 0);
  scene.add(seaMesh);

  let mapContainer = new Mesh(
    new CylinderGeometry(17.1, 17.1, MAX_HEIGHT * 0.25, 50, 1, true),
    new MeshPhysicalMaterial({
      envMap: envmap,
      map: textures.dirt,
      envMapIntensity: 0.2,
      side: THREE.DoubleSide,
    })
  );
  mapContainer.receiveShadow = true;
  mapContainer.position.set(0, MAX_HEIGHT * 0.125, 0);
  scene.add(mapContainer);

  let mapFloor = new Mesh(
    new CylinderGeometry(18.5, 18.5, MAX_HEIGHT * 0.1, 50),
    new MeshPhysicalMaterial({
      envMap: envmap,
      map: textures.dirt2,
      envMapIntensity: 0.1,
      side: THREE.DoubleSide,
    })
  );
  mapFloor.receiveShadow = true;
  mapFloor.position.set(0, MAX_HEIGHT * 0.05, 0);
  scene.add(mapFloor);
  clouds();

  const simplex = new SIMPLEX.createNoise2D();
  for (let i = -10; i <= 20; i++) {
    for (let j = -10; j <= 20; j++) {
      let position = tileToPosition(i, j);
      if (position.length() > 16) continue;
      let noise = (simplex(i * 0.1, j * 0.1) + 1) * 0.5;
      noise = Math.pow(noise, 1.5);
      makeHex(noise * MAX_HEIGHT, position);
    }
  }

  let stoneMesh = hexMesh(stoneGeo, textures.stone);
  let dirtMesh = hexMesh(dirtGeo, textures.dirt);
  let dirt2Mesh = hexMesh(dirt2Geo, textures.dirt2);
  let grassMesh = hexMesh(grassGeo, textures.grass);
  let sandMesh = hexMesh(sandGeo, textures.sand);
  scene.add(stoneMesh, dirtMesh, dirt2Mesh, grassMesh, sandMesh);

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });
})();

function tileToPosition(tileX, tileY) {
  return new Vector2((tileX + (tileY % 2) * 0.5) * 1.77, tileY * 1.535);
}

let stoneGeo = new BoxGeometry(0, 0, 0);
let dirtGeo = new BoxGeometry(0, 0, 0);
let dirt2Geo = new BoxGeometry(0, 0, 0);
let sandGeo = new BoxGeometry(0, 0, 0);
let grassGeo = new BoxGeometry(0, 0, 0);

function hexGeometry(height, position) {
  let geo = new THREE.CylinderGeometry(1, 1, height, 6, 1, false);
  geo.translate(position.x, height * 0.5, position.y);
  return geo;
}

function makeHex(height, position) {
  let geo = hexGeometry(height, position);
  if (height > STONE_HEIGHT) {
    stoneGeo = mergeBufferGeometries([geo, stoneGeo]);
    if (Math.random() > 0.8) {
      stoneGeo = mergeBufferGeometries([stoneGeo, stone(height, position)]);
    }
  } else if (height > DIRT_HEIGHT) {
    dirtGeo = mergeBufferGeometries([geo, dirtGeo]);
    if (Math.random() > 0.8) {
      grassGeo = mergeBufferGeometries([grassGeo, tree(height, position)]);
    }
  } else if (height > GRASS_HEIGHT) {
    grassGeo = mergeBufferGeometries([geo, grassGeo]);
  } else if (height > SAND_HEIGHT) {
    sandGeo = mergeBufferGeometries([geo, sandGeo]);

    if (Math.random() > 0.8 && stoneGeo) {
      stoneGeo = mergeBufferGeometries([stoneGeo, stone(height, position)]);
    }
  } else if (height > DIRT2_HEIGHT) {
    dirt2Geo = mergeBufferGeometries([geo, dirt2Geo]);
  }
}

function hexMesh(geo, map) {
  let mat = new THREE.MeshPhysicalMaterial({
    envMap: envmap,
    envMapIntensity: 0.135,
    flatShading: true,
    map,
  });
  let mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function stone(height, position) {
  const px = Math.random() * 0.4;
  const pz = Math.random() * 0.4;

  const geo = new SphereGeometry(Math.random() * 0.3 + 0.1, 7, 7);
  geo.translate(position.x + px, height, position.y + pz);
  return geo;
}

function tree(height, position) {
  const treeHeight = Math.random() * 1 + 1.25;

  const geo = new CylinderGeometry(0, 1.5, treeHeight, 3);
  geo.translate(position.x, height + treeHeight * 0 + 1, position.y);

  const geo2 = new CylinderGeometry(0, 1.15, treeHeight, 3);
  geo2.translate(position.x, height + treeHeight * 0.6 + 1, position.y);

  const geo3 = new CylinderGeometry(0, 0.8, treeHeight, 3);
  geo3.translate(position.x, height + treeHeight * 1.25 + 1, position.y);

  return mergeBufferGeometries([geo, geo2, geo3]);
}

function clouds() {
  let geo = new SphereGeometry(0, 0, 0);
  let count = Math.floor(Math.pow(Math.random(), 0.45) * 4);

  for (let i = 0; i < count; i++) {
    const puff1 = new SphereGeometry(1.2, 7, 7);
    const puff2 = new SphereGeometry(1.5, 7, 7);
    const puff3 = new SphereGeometry(0.9, 7, 7);

    puff1.translate(-1.85, Math.random() * 0.3, 0);
    puff2.translate(0, Math.random() * 0.3, 0);
    puff3.translate(1.85, Math.random() * 0.3, 0);

    const cloudGeo = mergeBufferGeometries([puff1, puff2, puff3]);
    cloudGeo.translate(
      Math.random() * 20 - 10,
      Math.random() * 7 + 7,
      Math.random() * 20 - 10
    );
    cloudGeo.rotateY(Math.random() * Math.PI * 2);

    geo = mergeBufferGeometries([geo, cloudGeo]);
  }

  const mesh = new Mesh(
    geo,
    new MeshStandardMaterial({
      envMap: envmap,
      envMapIntensity: 0.75,
      flatShading: true,
      transparent: true,
      opacity: 0.85,
    })
  );

  scene.add(mesh);
}
