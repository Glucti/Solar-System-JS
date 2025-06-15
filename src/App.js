import React, { useMemo } from "react";
import { useState, useRef } from "react";
import { Canvas, useLoader, useFrame } from "@react-three/fiber";
import { OrbitControls, Plane, Stars, Line} from "@react-three/drei";
import { MeshBasicMaterial, SphereGeometry, TextureLoader } from "three";
import styled from "styled-components";
import { SimplifyModifier } from "three/examples/jsm/Addons.js";

// TODO 
// add slider for the time, start and pause
// label the planets somehow
// add the perihelion and aphelion points to the orbit
// make the planets actually look cool
// stop the user from zooming out all the way
// add moons orbiting planets 0-0



const nasaPlanetData = {
  mercury: {
    a: [0.38709927, 0.00000037],
    e: [0.20563593, 0.00001906],
    I: [7.00497902, -0.00594749],
    L: [252.25032350, 149472.67411175],
    varpi: [77.45779628, 0.16047689],
    Omega: [48.33076593, -0.12534081],
  },
  venus: {
    a: [0.72333566, 0.00000390],
    e: [0.00677672, -0.00004107],
    I: [3.39467605, -0.00078890],
    L: [181.97909950, 58517.81538729],
    varpi: [131.60246718, 0.00268329],
    Omega: [76.67984255, -0.27769418],
  },
  earth: {
    a: [1.00000261, 0.00000562],
    e: [0.01671123, -0.00004392],
    I: [-0.00001531, -0.01294668],
    L: [100.46457166, 35999.37244981],
    varpi: [102.93768193, 0.32327364],
    Omega: [0.0, 0.0],
  },
  mars: {
    a: [1.52371034, 0.00001847],
    e: [0.09339410, 0.00007882],
    I: [1.84969142, -0.00813131],
    L: [-4.55343205, 19140.30268499],
    varpi: [-23.94362959, 0.44441088],
    Omega: [49.55953891, -0.29257343],
  },
  jupiter: {
    a: [5.20288700, -0.00011607],
    e: [0.04838624, -0.00013253],
    I: [1.30439695, -0.00183714],
    L: [34.39644051, 3034.74612775],
    varpi: [14.72847983, 0.21252668],
    Omega: [100.47390909, 0.20469106],
  },
  saturn: {
    a: [9.53667594, -0.00125060],
    e: [0.05386179, -0.00050991],
    I: [2.48599187, 0.00193609],
    L: [49.95424423, 1222.49362201],
    varpi: [92.59887831, -0.41897216],
    Omega: [113.66242448, -0.28867794],
  },
  uranus: {
    a: [19.18916464, -0.00196176],
    e: [0.04725744, -0.00004397],
    I: [0.77263783, -0.00242939],
    L: [313.23810451, 428.48202785],
    varpi: [170.95427630, 0.40805281],
    Omega: [74.01692503, 0.04240589],
  },
  neptune: {
    a: [30.06992276, 0.00026291],
    e: [0.00859048, 0.00005105],
    I: [1.77004347, 0.00035372],
    L: [-55.12002969, 218.45945325],
    varpi: [44.96476227, -0.32241464],
    Omega: [131.78422574, -0.00508664],
  },
};


class OrbitalElements {
  constructor (name) {
    this.coeffs = nasaPlanetData[name]
  }

  positionJD(JD) {

    let deg2rad = Math.PI / 180;
    const Epoch = 2451545.0; // Epoch in Julian Date

    const T = (JD - Epoch) / 36525; // secnturies from J2000
    const c = this.coeffs;

    // a -> semi major axis
    // e -> eccentricity
    // I -> inclination
    // L -> mean longitue
    // varpi -> longitude of perihelion
    // omega -> longitude of the ascending node

    // compute the planets six elements
    const a = c.a[0] + c.a[1] * T;
    const e = c.e[0] + c.e[1] * T;
    const I = c.I[0] + c.I[1] * T;
    const L = c.L[0] + c.L[1] * T;
    const varpi = c.varpi[0] + c.varpi[1] * T;
    const OMEGA = c.Omega[0] + c.Omega[1] * T;

    // compute the arguement of parihelion omega and mean anomaly M
    const omega = varpi - OMEGA;
    const M = L - varpi;

    const normalizeAngle = angle => ((angle % 360) + 360) % 360;
    const M_deg = normalizeAngle(M);
    const M_rad = M_deg * deg2rad;


    function solveKepler(M, e, tolerance = 1e-6) {
      let E = M; 
      let delta = 1;

      while (Math.abs(delta) > tolerance) {
        delta = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
        E -= delta;
      }
      return E;
    }

    const E = solveKepler(M_rad, e);

    // compute the true anomaly
    const v = 2 * Math.atan2(
      Math.sqrt(1 + e) * Math.sin(E / 2),
      Math.sqrt(1 - e) * Math.cos(E / 2)
    );

    // distance from sun
    const r = a * (1 - e * Math.cos(E));
    
    // position in orbital plane
    const x_orb = r * Math.cos(v);
    const y_orb = r * Math.sin(v);


    // convert to 3D coords 
    const cos = Math.cos, sin = Math.sin;

    const x = r * (cos(OMEGA * deg2rad) * cos(omega * deg2rad + v) - sin(OMEGA * deg2rad) * sin(omega * deg2rad + v) * cos(I * deg2rad));
    const y = r * (sin(OMEGA * deg2rad) * cos(omega * deg2rad + v) + cos(OMEGA * deg2rad) * sin(omega * deg2rad + v) * cos(I * deg2rad));
    const z = r * (sin(omega * deg2rad + v) * sin(I * deg2rad));
    
    return { x, y, z };
  }
}



function toJulianDate(date = new Date()) {
  const time = date.getTime();
  return time / 86400000 + 2440587.5 // ms in day + Unix epoch (Jan 1, 1970)
}

function fromJulianDate(jd) {
  return new Date((jd - 2440587.5) * 86400000);
}



function Planet({ name, JD, color, size}) {
  const orbitalElement = new OrbitalElements(name);
  const { x, y, z } = orbitalElement.positionJD(JD);

  const SUN_PADDING = 10;

  const distanceAU = Math.sqrt(x * x + y * y, z * z);
  const compressDistance = Math.log10(distanceAU + 1) * 50 + SUN_PADDING;
  const scaleFac = compressDistance / distanceAU;

  const posX = x * scaleFac;
  const posY = y * scaleFac;
  const posZ = z * scaleFac;

  return (
    <>
    <mesh position={[ posX, posY, posZ ]}>
    <sphereGeometry args={[size * 1.8, 64, 64]} />
        <meshPhysicalMaterial
          color={color}
          roughness={0.4}
          metalness={0.5}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
    </mesh>
    </>
  )
}

const planetVisuals = {
  mercury: { color: "white", size: 0.5 },
  venus: { color: "pink", size: 0.8 },
  earth: { color: "blue", size: 0.9 },
  mars: { color: "red", size: 0.6 },
  jupiter: { color: "purple", size: 1.8 },
  saturn: { color: "khaki", size: 1.5 },
  uranus: { color: "orange", size: 1.2 },
  neptune: { color: "lightblue", size: 1.1 },
};


function SolarSytem({ JD, setJD }) {
  const speed = 20;

  const JDref = useRef(JD);

  useFrame((_, delta) => {
    JDref.current += speed * delta;
    setJD(JDref.current);
  })

  return ( 
    <>
      {Object.keys(nasaPlanetData).map((name) => {
        const {color, size} = planetVisuals[name];

        return (
          <>
          <Planet key={name} name={name} JD={JD} color={color} size={size} />
          </>
        )
      })}

    </>
  )
}

function OrbitPath({ name }) {

  const points = useMemo(() => {
    const orbitalElement = new OrbitalElements(name);
    const points = [];

    for (let i = 0; i <= 60000; i++) {
      let projectionJD = 2451545.0 + i;
      const { x, y, z } = orbitalElement.positionJD(projectionJD);

      const SUN_PADDING = 10;

      const distanceAU = Math.sqrt(x * x + y * y, z * z);
      const compressDistance = Math.log10(distanceAU + 1) * 50 + SUN_PADDING;
      const scaleFac = compressDistance / distanceAU; 
      
      const posX = x * scaleFac;
      const posY = y * scaleFac;
      const posZ = z * scaleFac;

      points.push([ posX, posY, posZ ]);
    }
    return points;

  }, [name]);

  return (
    <Line
      points={points}
      color="grey"
      lineWidth={0.6}
      dashed={false}
    />
  )
}

function Sun() {
  return (
    <mesh castShadow receiveShadow>
      <sphereGeometry args={[6, 90, 90]} />
      <meshStandardMaterial
        color="yellow"
        emissive="#de1515"
        emissiveIntensity={3}
        roughness={0.2}
        metalness={1}
        toneMapped={false}
      />
    </mesh>
  );
}

export default function App() {
  const [JD, setJD] = useState(toJulianDate());
  const dateStr = fromJulianDate(JD).toLocaleDateString();

  return (
    <>

    <DateDisplay>
      {dateStr}
    </DateDisplay>
    <Canvas camera={{ position: [0, 0, 150], fov: 60 }}
            style={{ background: "black" }}>
      <ambientLight intensity={1.7}/>
      <pointLight position={[10, 20, 30]} intensity={150} />
      <OrbitControls />

      <Stars
        radius={200}
        count={1000}
        depth={50}
        factor={3}
        saturation={1} />

        <Sun />


      <SolarSytem JD={JD} setJD={setJD}/>
      {Object.keys(nasaPlanetData).map((name) => {
        return (
          <OrbitPath key={name} name={name} />
        )
      })}


    </Canvas>
    </>
  );
}

const DateDisplay = styled.div`
  position: absolute;
  top: 20px;
  bottom: 20px;
  padding-left: 20px;
  font-size: 25px;
  z-index: 10;
  color: white;
`

