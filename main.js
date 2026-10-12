import * as THREE from "three";

// The scene stores every visible object in our 3D world.
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ed8ff);
scene.fog = new THREE.Fog(0x9ed8ff, 24, 70);

// A perspective camera makes distant objects appear smaller.
const groundCamera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
groundCamera.position.set(10, 9, 12);
groundCamera.lookAt(0, 0, 0);

const riderCamera = new THREE.PerspectiveCamera(
  72,
  window.innerWidth / window.innerHeight,
  0.03,
  100,
);
let activeCamera = groundCamera;

// The renderer converts the 3D scene into pixels on the canvas.
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const triangleToggle = document.querySelector("#triangle-toggle");
const textureToggle = document.querySelector("#texture-toggle");
const performanceToggle = document.querySelector("#performance-toggle");
const rideToggle = document.querySelector("#ride-toggle");
const speedSlider = document.querySelector("#speed-slider");
const speedOutput = document.querySelector("#speed-output");
const performancePanel = document.querySelector(".performance-panel");
const fpsOutput = document.querySelector("#fps-output");
const frameTimeOutput = document.querySelector("#frame-time-output");
const drawCallsOutput = document.querySelector("#draw-calls-output");
const trianglesOutput = document.querySelector("#triangles-output");
const platformToggle = document.querySelector("#platform-toggle");
const groupsToggle = document.querySelector("#groups-toggle");
const cupsToggle = document.querySelector("#cups-toggle");
const cameraToggle = document.querySelector("#camera-toggle");
const dayToggle = document.querySelector("#day-toggle");
const numbersToggle = document.querySelector("#numbers-toggle");
const numberPanel = document.querySelector(".number-panel");
const localPointOutput = document.querySelector("#local-point");
const groupPointOutput = document.querySelector("#group-point");
const worldPointOutput = document.querySelector("#world-point");
const differenceOutput = document.querySelector("#difference-vector");
const axesToggle = document.querySelector("#axes-toggle");
const axisKey = document.querySelector(".axis-key");
const triangleMaterials = [];
const texturedCupMaterials = [];

const motion = {
  platform: true,
  groups: true,
  cups: true,
};
let rideRunning = true;
let rideSpeedMultiplier = 1;

// Broad sky light keeps surfaces from becoming completely black in shadow.
const skyLight = new THREE.HemisphereLight(0xffffff, 0x36516b, 2.2);
scene.add(skyLight);

const sun = new THREE.DirectionalLight(0xffffff, 2.5);
sun.position.set(6, 10, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -15;
sun.shadow.camera.right = 15;
sun.shadow.camera.top = 15;
sun.shadow.camera.bottom = -15;
scene.add(sun);

// PROJECT ENVIRONMENT: these objects stay still in world space while the ride
// moves, giving the viewer clear distance and motion reference points.
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshStandardMaterial({ color: 0x7ebc68, roughness: 0.95 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.27;
ground.receiveShadow = true;
scene.add(ground);

function createPavingTextures() {
  const size = 512;
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = size;
  colorCanvas.height = size;
  const colorContext = colorCanvas.getContext("2d");

  const heightCanvas = document.createElement("canvas");
  heightCanvas.width = size;
  heightCanvas.height = size;
  const heightContext = heightCanvas.getContext("2d");

  // Dark grout first, then lighter rectangular stones on top.
  colorContext.fillStyle = "#9a815c";
  colorContext.fillRect(0, 0, size, size);
  heightContext.fillStyle = "#353535";
  heightContext.fillRect(0, 0, size, size);

  const stoneWidth = 126;
  const stoneHeight = 62;
  const gap = 6;

  for (let row = 0; row < 8; row += 1) {
    const offset = row % 2 === 0 ? 0 : -stoneWidth / 2;

    for (let column = -1; column < 5; column += 1) {
      const x = column * stoneWidth + offset + gap / 2;
      const y = row * stoneHeight + gap / 2;
      const warmth = (row + column) % 3;
      const stoneColors = ["#dfbf86", "#e7ca94", "#d5b277"];

      colorContext.fillStyle = stoneColors[(warmth + 3) % 3];
      colorContext.fillRect(
        x,
        y,
        stoneWidth - gap,
        stoneHeight - gap,
      );

      // White means raised; black means low. The renderer uses these values
      // to change lighting without adding real stone geometry.
      heightContext.fillStyle = "#d8d8d8";
      heightContext.fillRect(
        x,
        y,
        stoneWidth - gap,
        stoneHeight - gap,
      );
    }
  }

  const colorTexture = new THREE.CanvasTexture(colorCanvas);
  colorTexture.colorSpace = THREE.SRGBColorSpace;
  colorTexture.wrapS = THREE.RepeatWrapping;
  colorTexture.wrapT = THREE.RepeatWrapping;
  colorTexture.repeat.set(5, 5);

  const heightTexture = new THREE.CanvasTexture(heightCanvas);
  heightTexture.wrapS = THREE.RepeatWrapping;
  heightTexture.wrapT = THREE.RepeatWrapping;
  heightTexture.repeat.copy(colorTexture.repeat);

  return { colorTexture, heightTexture };
}

const pavingTextures = createPavingTextures();

const path = new THREE.Mesh(
  new THREE.RingGeometry(6.5, 11.5, 64),
  new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: pavingTextures.colorTexture,
    bumpMap: pavingTextures.heightTexture,
    bumpScale: 0.07,
    roughness: 0.88,
  }),
);
path.rotation.x = -Math.PI / 2;
path.position.y = -0.255;
path.receiveShadow = true;
scene.add(path);

const fenceMaterial = new THREE.MeshStandardMaterial({
  color: 0xf8f0dd,
  roughness: 0.6,
});

const fencePostCount = 24;
const fencePosts = new THREE.InstancedMesh(
  new THREE.CylinderGeometry(0.07, 0.09, 1.25, 10),
  fenceMaterial,
  fencePostCount,
);
const fencePostTransform = new THREE.Object3D();

for (let postIndex = 0; postIndex < fencePostCount; postIndex += 1) {
  const angle = (postIndex / 24) * Math.PI * 2;
  fencePostTransform.position.set(
    Math.cos(angle) * 7.2,
    0.35,
    Math.sin(angle) * 7.2,
  );
  fencePostTransform.updateMatrix();
  fencePosts.setMatrixAt(postIndex, fencePostTransform.matrix);
}
fencePosts.instanceMatrix.needsUpdate = true;
fencePosts.castShadow = true;
scene.add(fencePosts);

for (const height of [0.22, 0.78]) {
  const rail = new THREE.Mesh(
    new THREE.TorusGeometry(7.2, 0.045, 8, 96),
    fenceMaterial,
  );
  rail.rotation.x = Math.PI / 2;
  rail.position.y = height;
  scene.add(rail);
}

function createBooth(color, x, z, turn) {
  const booth = new THREE.Group();
  booth.position.set(x, 0, z);
  booth.rotation.y = turn;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 1.8, 1.6),
    new THREE.MeshStandardMaterial({ color, roughness: 0.75 }),
  );
  body.position.y = 0.65;
  body.castShadow = true;
  body.receiveShadow = true;
  booth.add(body);

  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.16, 0.48),
    new THREE.MeshStandardMaterial({ color: 0xfff2d5, roughness: 0.65 }),
  );
  counter.position.set(0, 0.72, -0.95);
  booth.add(counter);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(2.05, 0.9, 4),
    new THREE.MeshStandardMaterial({ color: 0xffdf55, roughness: 0.55 }),
  );
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 1.95;
  roof.castShadow = true;
  booth.add(roof);

  scene.add(booth);
}

createBooth(0xf06b72, -10, -7, -0.45);
createBooth(0x4ba9c8, 9.5, -8, 0.55);
createBooth(0x8f6bc6, -11, 6.5, -2.35);

// Two visible fairground floodlight towers aim spotlights toward the ride.
// Their positions are written as [x, y, z] world coordinates.
const floodLights = [];
const floodlightPositions = [
  [-8.4, 0, -6.3],
  [8.4, 0, -6.3],
];

for (const [x, y, z] of floodlightPositions) {
  const tower = new THREE.Group();
  tower.position.set(x, y, z);

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.15, 5.5, 12),
    new THREE.MeshStandardMaterial({
      color: 0x303844,
      roughness: 0.55,
      metalness: 0.45,
    }),
  );
  pole.position.y = 2.48;
  pole.castShadow = true;
  tower.add(pole);

  const fixtureAim = new THREE.Group();
  fixtureAim.position.set(x, 5.35, z);
  fixtureAim.lookAt(0, 0.4, 0);

  const fixture = new THREE.Mesh(
    new THREE.BoxGeometry(0.64, 0.34, 0.54),
    new THREE.MeshStandardMaterial({
      color: 0x1c232c,
      roughness: 0.35,
      metalness: 0.55,
    }),
  );
  fixture.castShadow = true;
  fixtureAim.add(fixture);

  const lens = new THREE.Mesh(
    new THREE.PlaneGeometry(0.44, 0.22),
    new THREE.MeshStandardMaterial({
      color: 0xfff4cf,
      emissive: 0xffd777,
      emissiveIntensity: 0.35,
      side: THREE.DoubleSide,
    }),
  );
  lens.position.z = 0.275;
  fixtureAim.add(lens);

  const target = new THREE.Object3D();
  target.position.set(0, 0.4, 0);
  scene.add(target);

  const floodlight = new THREE.SpotLight(
    0xffe2a8,
    0,
    24,
    0.38,
    0.78,
    2,
  );
  floodlight.position.set(x, 5.35, z);
  floodlight.target = target;
  floodlight.castShadow = true;
  floodlight.shadow.mapSize.set(1024, 1024);
  floodlight.shadow.camera.near = 0.5;
  floodlight.shadow.camera.far = 24;
  // A small negative bias prevents the cups from drawing false shadow stripes
  // across their own surfaces while preserving their shadows on the platform.
  floodlight.shadow.bias = -0.0004;

  floodLights.push({ light: floodlight, lens });
  scene.add(floodlight, tower, fixtureAim);
}

const lampBulbMaterial = new THREE.MeshStandardMaterial({
  color: 0xffe5a3,
  emissive: 0xffb52e,
  emissiveIntensity: 0.8,
});
const lampLights = [];
const lampCount = 8;
const lampPoleInstances = new THREE.InstancedMesh(
  new THREE.CylinderGeometry(0.06, 0.09, 3.6, 10),
  new THREE.MeshStandardMaterial({ color: 0x334054, roughness: 0.55 }),
  lampCount,
);
const lampBulbInstances = new THREE.InstancedMesh(
  new THREE.SphereGeometry(0.18, 16, 12),
  lampBulbMaterial,
  lampCount,
);
const lampTransform = new THREE.Object3D();

for (let lampIndex = 0; lampIndex < lampCount; lampIndex += 1) {
  const angle = (lampIndex / lampCount) * Math.PI * 2 + Math.PI / 8;
  const lampX = Math.cos(angle) * 9.2;
  const lampZ = Math.sin(angle) * 9.2;

  lampTransform.position.set(lampX, 1.53, lampZ);
  lampTransform.updateMatrix();
  lampPoleInstances.setMatrixAt(lampIndex, lampTransform.matrix);

  lampTransform.position.set(lampX, 3.35, lampZ);
  lampTransform.updateMatrix();
  lampBulbInstances.setMatrixAt(lampIndex, lampTransform.matrix);

  // The visible bulb is instanced; its invisible point light still needs its
  // own position because each bulb illuminates a different part of the path.
  const bulbLight = new THREE.PointLight(0xffb64b, 0, 5.2, 1.8);
  bulbLight.position.set(lampX, 3.35, lampZ);
  lampLights.push(bulbLight);
  scene.add(bulbLight);
}

lampPoleInstances.instanceMatrix.needsUpdate = true;
lampBulbInstances.instanceMatrix.needsUpdate = true;
scene.add(lampPoleInstances, lampBulbInstances);

// LEVEL 1: the main platform. Every group becomes its child.
const ride = new THREE.Group();
scene.add(ride);

const axisHelpers = [];
const worldAxes = new THREE.AxesHelper(2.5);
worldAxes.position.y = 0.3;
worldAxes.visible = false;
scene.add(worldAxes);
axisHelpers.push(worldAxes);

const platform = new THREE.Mesh(
  new THREE.CylinderGeometry(6, 6, 0.5, 64),
  new THREE.MeshStandardMaterial({ color: 0xf3c84b, roughness: 0.55 }),
);
platform.castShadow = true;
platform.receiveShadow = true;
ride.add(platform);

// A fixed centerpiece makes the platform's own rotation easier to see. It is
// a child of `ride`, so it follows the platform but does not spin separately.
const centerColumn = new THREE.Group();
const centerStripeColors = [0xfff2d0, 0xd94e73];

// Short alternating cylinders form one tall striped pole. The pole begins
// above the cups, so it remains easy to see from the ground camera.
for (let stripeIndex = 0; stripeIndex < 7; stripeIndex += 1) {
  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.39, 0.43, 0.52, 24),
    new THREE.MeshStandardMaterial({
      color: centerStripeColors[stripeIndex % 2],
      roughness: 0.38,
      metalness: 0.04,
    }),
  );
  stripe.position.y = 0.48 + stripeIndex * 0.4;
  stripe.scale.y = 0.77;
  stripe.castShadow = true;
  centerColumn.add(stripe);
}
ride.add(centerColumn);

// The whole teapot is one group. We tilt this parent once, so its body, lid,
// spout and handle keep their arrangement and tilt together.
const centerTeapot = new THREE.Group();
centerTeapot.position.y = 3.45;
// Present the teapot mostly side-on to the ground camera so both its spout and
// opposite handle remain visible instead of one hiding behind the body.
centerTeapot.rotation.set(-0.08, 0, -0.24);

const teapotCeramicMaterial = new THREE.MeshStandardMaterial({
  color: 0xf7e6c4,
  roughness: 0.28,
  metalness: 0.03,
});
const teapotTrimMaterial = new THREE.MeshStandardMaterial({
  color: 0xd94e73,
  roughness: 0.32,
});

const teapotBody = new THREE.Mesh(
  new THREE.SphereGeometry(0.78, 32, 20),
  teapotCeramicMaterial,
);
teapotBody.scale.y = 0.72;
centerTeapot.add(teapotBody);

const teapotLid = new THREE.Mesh(
  new THREE.CylinderGeometry(0.46, 0.56, 0.16, 24),
  teapotTrimMaterial,
);
teapotLid.position.y = 0.55;
centerTeapot.add(teapotLid);

const teapotKnob = new THREE.Mesh(
  new THREE.SphereGeometry(0.14, 16, 12),
  teapotTrimMaterial,
);
teapotKnob.position.y = 0.75;
centerTeapot.add(teapotKnob);

const teapotSpout = new THREE.Mesh(
  new THREE.CylinderGeometry(0.12, 0.27, 1.15, 20),
  teapotCeramicMaterial,
);
teapotSpout.position.set(0.83, 0.16, 0);
teapotSpout.rotation.z = -Math.PI / 2.55;
centerTeapot.add(teapotSpout);

const teapotHandle = new THREE.Mesh(
  new THREE.TorusGeometry(0.5, 0.11, 12, 36),
  teapotTrimMaterial,
);
// This position is relative to the teapot—not the whole scene—so the handle
// stays attached when the ride turns.
teapotHandle.position.set(-0.72, 0.02, 0);
teapotHandle.rotation.set(0, 0, 0);
teapotHandle.scale.y = 1.12;
centerTeapot.add(teapotHandle);

centerTeapot.traverse((part) => {
  if (part.isMesh) {
    part.castShadow = true;
    part.receiveShadow = true;
  }
});
// The teapot is a child of the ride, so the ride's rotation carries it too.
ride.add(centerTeapot);

const groupColors = [0xff6685, 0x4fc3f7, 0x8bd450];
const groupRadius = 3.25;
let riderCup;
let riderCupGroup;

function createCupPaintTexture(color) {
  // This canvas is a flat 2D picture that will be wrapped around a cup body.
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  const paintedColor = `#${color.getHexString()}`;

  context.fillStyle = "#fff8e9";
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Broad vertical panels make it easy to see how the flat picture wraps.
  context.fillStyle = paintedColor;
  for (let x = 0; x < canvas.width; x += 128) {
    context.fillRect(x, 0, 64, canvas.height);
  }

  // Two horizontal gold bands circle the finished cup.
  context.fillStyle = "#f5c84c";
  context.fillRect(0, 38, canvas.width, 14);
  context.fillRect(0, 202, canvas.width, 14);

  // Repeated dots make stretching or distortion easy to notice.
  context.fillStyle = "#79345f";
  for (let x = 32; x < canvas.width; x += 64) {
    context.beginPath();
    context.arc(x, 128, 11, 0, Math.PI * 2);
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  return texture;
}

const cupPaintTextures = groupColors.map(
  (color) => createCupPaintTexture(new THREE.Color(color)),
);

function createTeacup(color, paintTexture) {
  // This empty group is the cup's local coordinate system. Rotating it rotates
  // the body, opening, rim and handle together around the cup's center.
  const teacup = new THREE.Group();

  const cupMaterial = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.28,
    metalness: 0.05,
  });
  triangleMaterials.push(cupMaterial);

  const paintedBodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: paintTexture,
    roughness: 0.3,
    metalness: 0.03,
  });
  paintedBodyMaterial.userData.paintTexture = paintTexture;
  texturedCupMaterials.push(paintedBodyMaterial);
  triangleMaterials.push(paintedBodyMaterial);

  // LatheGeometry spins this side profile around the Y axis to make the body.
  const profile = [
    new THREE.Vector2(0.46, 0),
    new THREE.Vector2(0.54, 0.12),
    new THREE.Vector2(0.68, 0.58),
    new THREE.Vector2(0.72, 0.72),
  ];
  const body = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 32),
    paintedBodyMaterial,
  );
  teacup.add(body);

  const interiorMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff4dd,
    roughness: 0.65,
    side: THREE.BackSide,
  });

  // This open tube is slightly smaller than the outer body. We render its
  // inward-facing surface so the inside of the cup catches light.
  const innerWall = new THREE.Mesh(
    new THREE.CylinderGeometry(0.61, 0.42, 0.5, 32, 1, true),
    interiorMaterial,
  );
  innerWall.position.y = 0.45;
  teacup.add(innerWall);

  // A circle closes the bottom of the interior.
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 32),
    new THREE.MeshStandardMaterial({ color: 0xfff4dd, roughness: 0.7 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.205;
  teacup.add(floor);

  const rimMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff7dc,
    roughness: 0.25,
  });
  triangleMaterials.push(rimMaterial);

  const rim = new THREE.Mesh(
    // The rim is narrow and sunk into the wall: its center is below the body's
    // top edge, so the two shapes visibly meet as one cup.
    new THREE.TorusGeometry(0.64, 0.035, 10, 32),
    rimMaterial,
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.675;
  teacup.add(rim);

  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.06, 10, 24),
    cupMaterial,
  );
  // TorusGeometry already lies in the vertical XY plane. Moving part of it
  // inside the cup hides the inner side and makes the visible part a handle.
  handle.position.set(0.66, 0.38, 0);
  handle.scale.set(0.72, 1.05, 1);
  teacup.add(handle);

  // Three small bench seats face the steering wheel in the center.
  const seatMaterial = new THREE.MeshStandardMaterial({
    color: 0x6f315f,
    roughness: 0.75,
  });

  for (let seatIndex = 0; seatIndex < 3; seatIndex += 1) {
    const seatAngle = (seatIndex / 3) * Math.PI * 2;
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.12, 0.2),
      seatMaterial,
    );
    seat.position.set(
      Math.cos(seatAngle) * 0.39,
      0.29,
      Math.sin(seatAngle) * 0.39,
    );
    seat.rotation.y = -seatAngle;
    teacup.add(seat);
  }

  const steeringMaterial = new THREE.MeshStandardMaterial({
    color: 0xf2bf3f,
    roughness: 0.3,
    metalness: 0.25,
  });
  const steeringPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.055, 0.28, 12),
    steeringMaterial,
  );
  steeringPost.position.y = 0.34;
  teacup.add(steeringPost);

  const steeringWheel = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.025, 8, 20),
    steeringMaterial,
  );
  steeringWheel.rotation.x = Math.PI / 2;
  steeringWheel.position.y = 0.5;
  teacup.add(steeringWheel);

  teacup.traverse((part) => {
    if (part.isMesh) {
      part.castShadow = true;
      part.receiveShadow = true;
    }
  });

  return teacup;
}

for (let groupIndex = 0; groupIndex < 3; groupIndex += 1) {
  const angle = (groupIndex / 3) * Math.PI * 2;

  // LEVEL 2: this group moves and rotates with the main ride.
  const cupGroup = new THREE.Group();
  cupGroup.userData.isCupGroup = true;
  cupGroup.position.set(
    Math.cos(angle) * groupRadius,
    0.4,
    Math.sin(angle) * groupRadius,
  );
  cupGroup.userData.spinDirection = groupIndex % 2 === 0 ? 1 : -1;
  ride.add(cupGroup);

  if (groupIndex === 0) {
    const groupAxes = new THREE.AxesHelper(1.5);
    groupAxes.position.y = 0.25;
    groupAxes.visible = false;
    cupGroup.add(groupAxes);
    axisHelpers.push(groupAxes);
  }

  const groupDisk = new THREE.Mesh(
    new THREE.CylinderGeometry(1.75, 1.75, 0.18, 48),
    new THREE.MeshStandardMaterial({
      color: groupColors[groupIndex],
      roughness: 0.65,
    }),
  );
  groupDisk.castShadow = true;
  groupDisk.receiveShadow = true;
  cupGroup.add(groupDisk);

  for (let cupIndex = 0; cupIndex < 3; cupIndex += 1) {
    const cupAngle = (cupIndex / 3) * Math.PI * 2;

    // LEVEL 3: each cup orbits its group and also spins around itself.
    const cupColor = new THREE.Color(groupColors[groupIndex]).lerp(
      new THREE.Color(0xffffff),
      0.35 + cupIndex * 0.12,
    );
    const cup = createTeacup(cupColor, cupPaintTextures[groupIndex]);
    cup.position.set(
      Math.cos(cupAngle) * 1.05,
      0.09,
      Math.sin(cupAngle) * 1.05,
    );
    cup.userData.spinSpeed = 0.8 + cupIndex * 0.2;
    cupGroup.add(cup);

    if (groupIndex === 0 && cupIndex === 0) {
      riderCup = cup;
      riderCupGroup = cupGroup;
      riderCamera.position.set(0, 1.08, 0);
      riderCamera.rotation.x = -0.2;
      riderCamera.rotation.y = Math.PI / 2;
      riderCup.add(riderCamera);
    }

    if (groupIndex === 0 && cupIndex === 0) {
      const cupAxes = new THREE.AxesHelper(1);
      cupAxes.position.y = 0.08;
      cupAxes.visible = false;
      cup.add(cupAxes);
      axisHelpers.push(cupAxes);
    }
  }
}

const clock = new THREE.Clock();
let measuredFrames = 0;
let measuredSeconds = 0;

function animate() {
  const deltaTime = clock.getDelta();
  measuredFrames += 1;
  measuredSeconds += deltaTime;

  // Parent motion: this carries all three groups and all nine cups.
  if (rideRunning && motion.platform) {
    ride.rotation.y += 0.2 * rideSpeedMultiplier * deltaTime;
  }

  // Select by meaning, not by position in the children list. The ride also
  // contains decorative children, and those must not receive cup-group motion.
  const cupGroups = ride.children.filter(
    (child) => child.userData.isCupGroup,
  );

  for (const cupGroup of cupGroups) {
    // Group motion: this carries the three cups attached to this disk.
    if (rideRunning && motion.groups) {
      cupGroup.rotation.y +=
        cupGroup.userData.spinDirection *
        0.55 *
        rideSpeedMultiplier *
        deltaTime;
    }

    for (const child of cupGroup.children.slice(1)) {
      // Local motion: this changes only one cup's orientation.
      if (rideRunning && motion.cups && child.userData.spinSpeed) {
        child.rotation.y +=
          child.userData.spinSpeed * rideSpeedMultiplier * deltaTime;
      }
    }
  }

  renderer.render(scene, activeCamera);

  if (!performancePanel.hidden && measuredSeconds >= 0.5) {
    const framesPerSecond = measuredFrames / measuredSeconds;
    const millisecondsPerFrame = 1000 / framesPerSecond;

    fpsOutput.textContent = framesPerSecond.toFixed(1);
    frameTimeOutput.textContent = `${millisecondsPerFrame.toFixed(2)} ms`;
    drawCallsOutput.textContent = renderer.info.render.calls.toLocaleString();
    trianglesOutput.textContent =
      renderer.info.render.triangles.toLocaleString();

    measuredFrames = 0;
    measuredSeconds = 0;
  }

  if (!numberPanel.hidden) {
    updateNumberPanel();
  }
}

renderer.setAnimationLoop(animate);

function connectMotionButton(button, level, runningText, pausedText) {
  button.addEventListener("click", () => {
    motion[level] = !motion[level];
    button.textContent = motion[level] ? runningText : pausedText;
  });
}

connectMotionButton(
  platformToggle,
  "platform",
  "Pause platform",
  "Start platform",
);
connectMotionButton(groupsToggle, "groups", "Pause groups", "Start groups");
connectMotionButton(cupsToggle, "cups", "Pause cups", "Start cups");

rideToggle.addEventListener("click", () => {
  rideRunning = !rideRunning;
  rideToggle.textContent = rideRunning ? "Stop ride" : "Start ride";
});

speedSlider.addEventListener("input", () => {
  rideSpeedMultiplier = Number(speedSlider.value);
  speedOutput.value = `${rideSpeedMultiplier.toFixed(2)}×`;
});

const groupWorldPoint = new THREE.Vector3();
const cupWorldPoint = new THREE.Vector3();
const pointDifference = new THREE.Vector3();

function formatThreeNumbers(value, w) {
  return `[${value.x.toFixed(2)}, ${value.y.toFixed(2)}, ${value.z.toFixed(2)}, w=${w}]`;
}

function updateNumberPanel() {
  riderCupGroup.getWorldPosition(groupWorldPoint);
  riderCup.getWorldPosition(cupWorldPoint);
  pointDifference.subVectors(cupWorldPoint, groupWorldPoint);

  localPointOutput.textContent = formatThreeNumbers(riderCup.position, 1);
  groupPointOutput.textContent = formatThreeNumbers(groupWorldPoint, 1);
  worldPointOutput.textContent = formatThreeNumbers(cupWorldPoint, 1);
  differenceOutput.textContent = formatThreeNumbers(pointDifference, 0);
}

numbersToggle.addEventListener("click", () => {
  numberPanel.hidden = !numberPanel.hidden;
  numbersToggle.textContent = numberPanel.hidden ? "Show numbers" : "Hide numbers";
  updateNumberPanel();
});

let usingRiderCamera = false;
cameraToggle.addEventListener("click", () => {
  usingRiderCamera = !usingRiderCamera;
  activeCamera = usingRiderCamera ? riderCamera : groundCamera;
  cameraToggle.textContent = usingRiderCamera ? "Ground view" : "Ride a cup";
});

let nightMode = false;
dayToggle.addEventListener("click", () => {
  nightMode = !nightMode;

  const skyColor = nightMode ? 0x10172e : 0x9ed8ff;
  scene.background.set(skyColor);
  scene.fog.color.set(skyColor);

  sun.color.set(nightMode ? 0x9bb7ff : 0xffffff);
  sun.intensity = nightMode ? 0.18 : 2.5;
  skyLight.intensity = nightMode ? 0.32 : 2.2;
  lampBulbMaterial.emissiveIntensity = nightMode ? 2.4 : 0.8;

  for (const light of lampLights) {
    light.intensity = nightMode ? 14 : 0;
  }

  for (const { light, lens } of floodLights) {
    light.intensity = nightMode ? 105 : 0;
    lens.material.emissiveIntensity = nightMode ? 3.2 : 0.35;
  }

  dayToggle.textContent = nightMode ? "Day mode" : "Night mode";
});

let showingAxes = false;
axesToggle.addEventListener("click", () => {
  showingAxes = !showingAxes;

  for (const helper of axisHelpers) {
    helper.visible = showingAxes;
  }

  axisKey.hidden = !showingAxes;
  axesToggle.textContent = showingAxes ? "Hide axes" : "Show axes";
});

let showingTriangles = false;
triangleToggle.addEventListener("click", () => {
  showingTriangles = !showingTriangles;

  for (const material of triangleMaterials) {
    material.wireframe = showingTriangles;
  }

  triangleToggle.textContent = showingTriangles
    ? "Show surfaces"
    : "Show triangles";
});

let showingCupPaint = true;
textureToggle.addEventListener("click", () => {
  showingCupPaint = !showingCupPaint;

  for (const material of texturedCupMaterials) {
    material.map = showingCupPaint ? material.userData.paintTexture : null;
    material.needsUpdate = true;
  }

  textureToggle.textContent = showingCupPaint
    ? "Hide cup paint"
    : "Show cup paint";
});

performanceToggle.addEventListener("click", () => {
  performancePanel.hidden = !performancePanel.hidden;
  performanceToggle.textContent = performancePanel.hidden
    ? "Show performance"
    : "Hide performance";
  measuredFrames = 0;
  measuredSeconds = 0;
});

window.addEventListener("resize", () => {
  groundCamera.aspect = window.innerWidth / window.innerHeight;
  groundCamera.updateProjectionMatrix();
  riderCamera.aspect = window.innerWidth / window.innerHeight;
  riderCamera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
