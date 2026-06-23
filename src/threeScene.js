// threeScene.js - High-performance 3D Scene Controller using Three.js

import * as THREE from 'three';

// Procedural GLSL Simplex Noise for Mars texture rendering
const simplexNoiseGLSL = `
  // Description : Array and textureless GLSL 2D/3D/4D simplex 
  //               noise functions.
  //      Author : Ian McEwan, Ashima Arts.
  //  Maintainer : stegu
  //     Lastmod : 20110822 (ijm)
  //     License : Copyright (C) 2011 Ashima Arts. All rights reserved.
  //               Distributed under the MIT License. See LICENSE file.
  //               https://github.com/ashima/webgl-noise

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

    // First corner
    vec3 i  = floor(v + dot(v, D.yyy) );
    vec3 x0 =   v - i + dot(i, D.xxx) ;

    // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );

    //   x0 = x0 - 0.0 + 0.0 * C.xxx;
    //   x1 = x0 - i1 + 1.0 * C.xxx;
    //   x2 = x0 - i2 + 2.0 * C.xxx;
    //   x3 = x0 - 1.0 + 3.0 * C.xxx;
    vec3 x1 = x0 - i1 + D.xxx;
    vec3 x2 = x0 - i2 + D.yyy; // 2.0*C.x = 1/3 = D.y
    vec3 x3 = x0 - D.zzz;      // 3.0*C.x = 0.5 = D.z

    // Permutations
    i = mod289(i);
    vec4 p = permute( permute( permute(
               i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
             + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

    // Gradients: 7x7 points over a square, mapped onto an octahedron.
    // The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
    float n_ = 0.142857142857; // 1.0/7.0
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z);  //  mod(p,7*7)

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );

    //vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;
    //vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);

    //Normalise gradients
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    // Mix final noise value
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                  dot(p2,x2), dot(p3,x3) ) );
  }
`;

class ThreeScene {
  constructor() {
    this.container = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.mars = null;
    this.atmosphere = null;
    this.orbitalGroup = null;
    this.starfield = null;
    this.clock = new THREE.Clock();
    
    // Mouse tracking for parallax
    this.mouseX = 0;
    this.mouseY = 0;
    this.targetMouseX = 0;
    this.targetMouseY = 0;
    
    // Scroll tracking
    this.scrollProgress = 0;

    // Performance and Visibility Trackers
    this.isMobile = false;
    this.isPrimarySceneVisible = true;
  }

  init(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.isMobile = window.innerWidth < 768;

    // 1. Scene & Camera (Fog matched to brand background #0E0E0E)
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0e0e0e, 0.015);

    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 10);

    // 2. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    // 3. Ambient Starfield
    this.createStarfield();

    // 4. Procedural Mars (Always enabled, optimized segment count on mobile)
    this.createProceduralMars();
    this.createOrbitLines();

    // 5. Lighting (Ambient color adjusted to #0E0E0E context)
    const ambientLight = new THREE.AmbientLight(0x0E0E0E, 1.5);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xFFFFFF, 3.5);
    sunLight.position.set(5, 3, 5);
    this.scene.add(sunLight);

    // 6. Intersection Observers for Lazy Loading / Render Pausing
    const heroSection = document.getElementById('hero');
    if (heroSection) {
      const heroObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          this.isPrimarySceneVisible = entry.isIntersecting;
        });
      }, { threshold: 0.05 });
      heroObserver.observe(heroSection);
    }

    // Event Listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    window.addEventListener('scroll', this.onScroll.bind(this));

    // Start Loop
    this.animate();
  }

  createStarfield() {
    // Render 1500 particles on mobile and 6000 on desktop
    const starCount = this.isMobile ? 1500 : 6000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    const colorBlue = new THREE.Color(0x00D4FF);
    const colorPurple = new THREE.Color(0x7B2FFF);
    const colorWhite = new THREE.Color(0xFFFFFF);

    for (let i = 0; i < starCount * 3; i += 3) {
      // Sphere distribution for galactic feel
      const radius = 15 + Math.random() * 50;
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);

      positions[i] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i + 2] = radius * Math.cos(phi);

      // Color interpolation (Mostly white/blue, some purple nodes)
      const rand = Math.random();
      let starColor;
      if (rand > 0.85) starColor = colorPurple;
      else if (rand > 0.5) starColor = colorBlue;
      else starColor = colorWhite;

      colors[i] = starColor.r;
      colors[i + 1] = starColor.g;
      colors[i + 2] = starColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Custom shader material for glowing round points
    const material = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.starfield = new THREE.Points(geometry, material);
    this.scene.add(this.starfield);
  }

  createProceduralMars() {
    const segments = this.isMobile ? 24 : 64;
    const geometry = new THREE.SphereGeometry(2.2, segments, segments);
    
    // Custom shader material to generate Mars texture procedurally using noise
    const marsMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        ${simplexNoiseGLSL}
        
        uniform vec3 sunDirection;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;
 
        // FBM (Fractional Brownian Motion) helper
        float fbm(vec3 p) {
          float value = 0.0;
          float amplitude = 0.5;
          float frequency = 1.0;
          for(int i = 0; i < 4; i++) {
            value += amplitude * snoise(p * frequency);
            frequency *= 2.0;
            amplitude *= 0.5;
          }
          return value;
        }
 
        void main() {
          // Normalize position for noise sampling
          vec3 samplePos = normalize(vPosition) * 2.5;
          
          // Generate complex terrain noise
          float n = fbm(samplePos);
          float detail = fbm(samplePos * 4.5) * 0.2;
          float heightVal = n + detail;
 
          // Palette Definitions (Mars Reds, Oranges, Dark Plains, Ice Caps)
          vec3 darkRust = vec3(0.35, 0.09, 0.04);
          vec3 brightRust = vec3(0.85, 0.33, 0.18);
          vec3 sandOrange = vec3(0.95, 0.55, 0.3);
          vec3 iceCap = vec3(0.95, 0.95, 1.0);
          
          vec3 color = mix(darkRust, brightRust, smoothstep(-0.4, 0.3, heightVal));
          color = mix(color, sandOrange, smoothstep(0.3, 0.7, heightVal));
 
          // Polar Ice Caps at Y extremities
          float polarGrip = abs(normalize(vPosition).y);
          color = mix(color, iceCap, smoothstep(0.88, 0.98, polarGrip + n * 0.04));
 
          // Lighting
          vec3 light = normalize(sunDirection);
          float dProd = max(0.0, dot(vNormal, light));
          
          // Simple atmosphere rim lighting (fresnel)
          float fresnel = pow(1.0 - max(0.0, dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.0);
          vec3 rimColor = vec3(1.0, 0.3, 0.3) * fresnel * 0.8;
 
          vec3 finalColor = color * (dProd * 0.9 + 0.1) + rimColor;
          
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      uniforms: {
        sunDirection: { value: new THREE.Vector3(5, 3, 5).normalize() }
      }
    });
 
    this.mars = new THREE.Mesh(geometry, marsMaterial);
    // Position Mars initially in Hero section center-right on desktop, or centered on mobile
    if (window.innerWidth < 1024) {
      this.mars.position.set(0, -1.2, 0);
    } else {
      this.mars.position.set(2.5, 0, 0);
    }
    this.scene.add(this.mars);

    // Glowing Atmospheric Outer Shell
    const atmosGeom = new THREE.SphereGeometry(2.32, 32, 32);
    const atmosMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          // Fresnel calculation on atmosphere mesh
          float intensity = pow(0.65 - dot(vNormal, vec3(0, 0, 1.0)), 4.0);
          vec3 glowColor = vec3(0.0, 0.83, 1.0); // Electric Blue atmosphere
          gl_FragColor = vec4(glowColor * intensity, intensity * 0.75);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false
    });

    this.atmosphere = new THREE.Mesh(atmosGeom, atmosMat);
    this.mars.add(this.atmosphere);
  }

  createOrbitLines() {
    this.orbitalGroup = new THREE.Group();
    
    // Orbital Data Rings
    const createRing = (radius, color, rotationX, rotationY) => {
      const geometry = new THREE.RingGeometry(radius, radius + 0.03, 64);
      const material = new THREE.MeshBasicMaterial({
        color: color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.35
      });
      const ring = new THREE.Mesh(geometry, material);
      ring.rotation.x = rotationX;
      ring.rotation.y = rotationY;
      
      // Add data nodes to the ring
      const pointsGeom = new THREE.BufferGeometry();
      const pointCount = 5;
      const positions = new Float32Array(pointCount * 3);
      for(let i=0; i<pointCount; i++) {
        const theta = (i / pointCount) * Math.PI * 2;
        positions[i*3] = Math.cos(theta) * radius;
        positions[i*3+1] = Math.sin(theta) * radius;
        positions[i*3+2] = 0;
      }
      pointsGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const pointsMat = new THREE.PointsMaterial({
        color: color,
        size: 0.15,
        transparent: true,
        opacity: 0.9
      });
      const points = new THREE.Points(pointsGeom, pointsMat);
      ring.add(points);
      
      this.orbitalGroup.add(ring);
    };

    // Add three orbital networks representing analytics orbits
    createRing(3.2, 0x00D4FF, Math.PI / 2.3, Math.PI / 12);
    createRing(3.8, 0x7B2FFF, Math.PI / 1.7, -Math.PI / 6);
    createRing(4.5, 0xFF4D4D, -Math.PI / 3.2, Math.PI / 8);

    this.mars.add(this.orbitalGroup);
  }




  // --- WINDOW EVENT HANDLERS ---
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.isMobile = window.innerWidth < 768;

    // Adjust Mars position based on screen width
    if (this.mars) {
      if (window.innerWidth < 1024) {
        this.mars.position.set(0, -1.2, 0);
      } else {
        this.mars.position.set(2.5, 0, 0);
      }
    }


  }

  onMouseMove(e) {
    // Normalise mouse: -1 to +1
    this.targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
    this.targetMouseY = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  onScroll() {
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (totalHeight === 0) return;
    this.scrollProgress = window.scrollY / totalHeight;
  }

  // --- RENDERING LOOP ---
  animate() {
    requestAnimationFrame(this.animate.bind(this));

    const time = this.clock.getElapsedTime();

    // 1. Slow, organic Mars rotation (Disabled on mobile)
    if (!this.isMobile && this.mars) {
      this.mars.rotation.y = time * 0.05;
      this.mars.rotation.x = 0.2 + Math.sin(time * 0.02) * 0.05;
    }

    // 2. Orbital rings counter-rotation (Disabled on mobile)
    if (!this.isMobile && this.orbitalGroup) {
      this.orbitalGroup.children.forEach((child, index) => {
        const direction = index % 2 === 0 ? 1 : -1;
        child.rotation.z = time * 0.08 * direction;
      });
    }

    // 3. Mouse response parallax drift (interpolate smoothly)
    this.mouseX += (this.targetMouseX - this.mouseX) * 0.05;
    this.mouseY += (this.targetMouseY - this.mouseY) * 0.05;

    if (this.camera) {
      // Gentle camera reaction to mouse movement
      this.camera.position.x = this.mouseX * 0.8;
      this.camera.position.y = this.mouseY * 0.8;
      this.camera.lookAt(0, 0, 0);
    }

    // 4. Scroll triggered transitions (Disabled on mobile)
    if (!this.isMobile && this.mars) {
      const scrollRatio = this.scrollProgress;
      
      // Desktop scrolling layout transition
      if (window.innerWidth >= 1024) {
        // Hero: set at (2.5, 0, 0)
        // Scroll down: move to center (0, 0, -2) and down as visual background
        this.mars.position.x = 2.5 - scrollRatio * 4.5;
        this.mars.position.y = -scrollRatio * 1.5;
        this.mars.position.z = -scrollRatio * 3.0;
      } else {
        // Mobile scrolling layout transition
        this.mars.position.y = -1.2 - scrollRatio * 2.0;
        this.mars.position.z = -scrollRatio * 4.0;
      }
    }

    // 5. Starfield gentle rotation (Always runs as a lightweight background)
    if (this.starfield) {
      this.starfield.rotation.y = time * 0.005;
      this.starfield.rotation.x = time * 0.002;
    }

    // Render primary scene (Only render when visible on screen to save resources)
    if (this.renderer && this.scene && this.camera && this.isPrimarySceneVisible) {
      this.renderer.render(this.scene, this.camera);
    }


  }
}

export const threeScene = new ThreeScene();
export default threeScene;
