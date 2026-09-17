// ============================================================
// MAP GAME — world_visuals.js
// Alpha 0.1.1b scenic world layer
// Adds authored-feeling areas without changing gameplay state.
// ============================================================

(() => {
  "use strict";

  if (window.__mapGameVisualsLoaded) return;
  window.__mapGameVisualsLoaded = true;

  function start(runtime) {
    if (!runtime || !runtime.scene || !window.BABYLON) return;

    const {
      scene,
      engine,
      camera,
      shadowGenerator
    } = runtime;

    const scenicRoots = [];
    let pipeline = null;

    function mat(name, diffuse, emissive = null, alpha = 1) {
      const m = new BABYLON.StandardMaterial(name, scene);
      m.diffuseColor = new BABYLON.Color3(...diffuse);
      if (emissive) m.emissiveColor = new BABYLON.Color3(...emissive);
      m.specularColor = new BABYLON.Color3(.16, .18, .19);
      m.alpha = alpha;
      return m;
    }

    const stone = mat("scenicStone", [.30,.34,.37]);
    const stoneLight = mat("scenicStoneLight", [.52,.55,.56]);
    const wood = mat("scenicWood", [.29,.17,.085]);
    const darkMetal = mat("scenicDarkMetal", [.075,.09,.105]);
    const beach = mat("scenicBeach", [.72,.63,.43]);
    const grassDark = mat("scenicGrassDark", [.09,.25,.12]);
    const leafA = mat("scenicLeafA", [.08,.31,.13]);
    const leafB = mat("scenicLeafB", [.12,.39,.16]);
    const leafC = mat("scenicLeafC", [.17,.44,.19]);
    const lightWarm = mat("scenicWarmLight", [.18,.13,.05], [1.0,.48,.12]);
    const glass = mat("scenicGlass", [.09,.28,.39], [.015,.045,.06], .78);
    glass.specularColor = new BABYLON.Color3(.75,.88,.95);

    function markScenic(mesh) {
      if (!mesh) return mesh;
      mesh.isPickable = false;
      mesh.metadata = { ...(mesh.metadata || {}), scenic: true };
      return mesh;
    }

    function addCaster(mesh) {
      try { shadowGenerator.addShadowCaster(mesh); } catch (_) {}
      return mesh;
    }

    function box(name, x, y, z, w, h, d, material, parent = null) {
      const mesh = BABYLON.MeshBuilder.CreateBox(name, { width:w, height:h, depth:d }, scene);
      mesh.position.set(x,y,z);
      mesh.material = material;
      mesh.parent = parent;
      markScenic(mesh);
      addCaster(mesh);
      return mesh;
    }

    function cylinder(name, x, y, z, height, diameter, material, parent = null, tessellation = 12) {
      const mesh = BABYLON.MeshBuilder.CreateCylinder(name, { height, diameter, tessellation }, scene);
      mesh.position.set(x,y,z);
      mesh.material = material;
      mesh.parent = parent;
      markScenic(mesh);
      addCaster(mesh);
      return mesh;
    }

    function tree(x,z,scale=1,variant=0,parent=null) {
      const root = new BABYLON.TransformNode("scenicTreeRoot", scene);
      root.position.set(x,0,z);
      root.scaling.setAll(scale);
      root.parent = parent;

      const trunk = cylinder("scenicTreeTrunk",0,3.0,0,6.0,.9,wood,root,8);
      const leafMat = [leafA,leafB,leafC][variant%3];

      const crown = BABYLON.MeshBuilder.CreateIcoSphere("scenicTreeCrown", { radius:3.4, subdivisions:1 }, scene);
      crown.position.set(0,7.0,0);
      crown.scaling.set(1,1.15,1);
      crown.material = leafMat;
      crown.parent = root;
      markScenic(crown);
      addCaster(crown);

      const crown2 = BABYLON.MeshBuilder.CreateIcoSphere("scenicTreeCrown2", { radius:2.35, subdivisions:1 }, scene);
      crown2.position.set(1.3,8.0,.4);
      crown2.material = leafMat;
      crown2.parent = root;
      markScenic(crown2);
      addCaster(crown2);

      return root;
    }

    function lamp(x,z,parent=null) {
      const root = new BABYLON.TransformNode("scenicLamp", scene);
      root.position.set(x,0,z);
      root.parent = parent;
      cylinder("scenicLampPost",0,3.2,0,6.4,.22,darkMetal,root,8);
      box("scenicLampHead",0,6.3,0,.75,.28,.75,lightWarm,root);
      return root;
    }

    function createCivicDistrict() {
      const root = new BABYLON.TransformNode("CivicDistrict",scene);
      scenicRoots.push(root);

      const plaza = box("civicPlaza",0,.06,-118,94,.12,66,stoneLight,root);
      plaza.receiveShadows = true;

      // stepped civic landmark
      box("civicPodium",0,2.0,-128,46,4,30,stone,root);
      box("civicMain",0,9.5,-128,31,15,24,stoneLight,root);
      box("civicGlass",0,11,-140.2,22,9,.5,glass,root);
      box("civicRoof",0,17.5,-128,36,.7,28,darkMetal,root);
      cylinder("civicSpire",0,22,-128,9,.75,darkMetal,root,10);

      // central fountain basin / sculpture
      cylinder("fountainBasin",0,.55,-91,2.0,15,stone,root,24);
      cylinder("fountainCore",0,3.0,-91,5.0,2.2,stoneLight,root,16);
      const waterDisc = BABYLON.MeshBuilder.CreateCylinder("fountainWater", { height:.22, diameter:12.6, tessellation:24 }, scene);
      waterDisc.position.set(0,1.48,-91);
      waterDisc.material = runtime.waterMaterial;
      waterDisc.parent=root;
      markScenic(waterDisc);

      for (let i=-3;i<=3;i++) {
        lamp(-32,-91+i*8,root);
        lamp(32,-91+i*8,root);
      }

      [-42,-29,29,42].forEach((x,idx)=>{
        tree(x,-118,1.0,idx,root);
        tree(x,-79,.9,idx+1,root);
      });
    }

    function createAzureCoast() {
      const root = new BABYLON.TransformNode("AzureCoastScenic",scene);
      scenicRoots.push(root);
      root.position.set(980,0,790);

      // beach strip and boardwalk
      box("azureBeach",0,-.20,0,300,.25,105,beach,root).receiveShadows=true;
      box("azureBoardwalk",0,.10,-36,265,.26,10,wood,root);

      for (let x=-118;x<=118;x+=22) lamp(x,-36,root);

      // pier
      box("azurePier",68,.05,54,10,.35,150,wood,root);
      for(let z=10;z<=118;z+=18){
        cylinder("pierPostL",64,-1.8,z,4,.5,darkMetal,root,8);
        cylinder("pierPostR",72,-1.8,z,4,.5,darkMetal,root,8);
      }

      // lighthouse landmark
      cylinder("lighthouseBase",-86,8.5,28,17,11,stoneLight,root,16);
      cylinder("lighthouseTop",-86,18.0,28,4.5,8,darkMetal,root,16);
      box("lighthouseGlow",-86,20.5,28,6.0,1.1,6.0,lightWarm,root);

      // low resort silhouettes
      for (let i=0;i<6;i++) {
        const x=-110+i*42;
        box("coastResort",x,6,-74,30,12,22,stoneLight,root);
        box("coastResortGlass",x,7.2,-85.2,22,6,.35,glass,root);
      }
    }

    function createEmeraldBasin() {
      const root = new BABYLON.TransformNode("EmeraldBasinScenic",scene);
      scenicRoots.push(root);
      root.position.set(930,0,-650);

      // Curated clusters; enough to read as forest without thousands of meshes.
      const points=[];
      for(let ring=0;ring<5;ring++){
        const radius=55+ring*34;
        const count=10+ring*5;
        for(let i=0;i<count;i++){
          const a=(i/count)*Math.PI*2 + ring*.37;
          const wobble=Math.sin(i*2.31+ring)*11;
          points.push([Math.cos(a)*(radius+wobble),Math.sin(a)*(radius+wobble)]);
        }
      }
      points.forEach((p,i)=>tree(p[0],p[1],.72+(i%5)*.08,i,root));

      // forest visitor lodge
      box("basinLodge",0,5,0,36,10,24,wood,root);
      box("basinLodgeRoof",0,10.5,0,41,1.0,29,darkMetal,root);
      box("basinLodgeGlass",0,5,-12.2,20,5,.35,glass,root);
    }

    function createHighlandObservatory() {
      const root=new BABYLON.TransformNode("HighlandObservatory",scene);
      scenicRoots.push(root);
      root.position.set(-1080,0,-690);

      box("obsPlatform",0,1.0,0,70,2,55,stone,root);
      cylinder("obsTower",0,8,0,14,18,stoneLight,root,16);
      const dome=BABYLON.MeshBuilder.CreateSphere("obsDome",{diameter:20,segments:16,slice:.5},scene);
      dome.position.set(0,15,0);
      dome.material=glass;
      dome.parent=root;
      markScenic(dome);addCaster(dome);

      // radio masts
      [-24,24].forEach(x=>{
        cylinder("obsMast",x,13,8,24,.8,darkMetal,root,8);
        box("obsBeacon",x,25,8,1.6,1.1,1.6,lightWarm,root);
      });
    }

    function createMeridianFields() {
      const root=new BABYLON.TransformNode("MeridianFields",scene);
      scenicRoots.push(root);
      root.position.set(-820,0,890);

      const fieldColors=[
        mat("fieldA",[.29,.39,.12]),
        mat("fieldB",[.42,.42,.13]),
        mat("fieldC",[.18,.34,.12])
      ];
      for(let ix=0;ix<4;ix++){
        for(let iz=0;iz<3;iz++){
          const p=box("fieldPlot",(ix-1.5)*70,.03,(iz-1)*64,58,.06,50,fieldColors[(ix+iz)%3],root);
          p.receiveShadows=true;
        }
      }
      box("fieldBarn",0,5,-112,34,10,25,stone,root);
      box("fieldBarnRoof",0,10.5,-112,39,1,30,darkMetal,root);
    }

    function createNightSkylineLights() {
      // Distant skyline lights near the capital create a much better night read.
      const root=new BABYLON.TransformNode("SkylineLights",scene);
      scenicRoots.push(root);
      const positions=[[-70,-52],[-48,-58],[-25,-56],[18,-54],[43,-60],[67,-50]];
      positions.forEach((p,i)=>{
        const h=20+(i%3)*8;
        const building=box("skylineBuilding",p[0],h/2,p[1],13,h,13,darkMetal,root);
        for(let y=5;y<h-3;y+=5){
          for(let x=-4;x<=4;x+=4){
            const win=box("skylineWindow",p[0]+x,y,p[1]-6.65,1.2,1.5,.15,lightWarm,root);
            win.parent=null; // root position is zero; preserve world coordinates
          }
        }
      });
    }

    createCivicDistrict();
    createAzureCoast();
    createEmeraldBasin();
    createHighlandObservatory();
    createMeridianFields();
    createNightSkylineLights();

    function applyPreset(preset) {
      const regular=preset === "REGULAR";

      scenicRoots.forEach(root=>{
        if (root.name === "EmeraldBasinScenic") {
          // Basic keeps most of the forest, Regular shows all of it.
          root.setEnabled(true);
        }
      });

      try {
        if (!pipeline) {
          pipeline = new BABYLON.DefaultRenderingPipeline(
            "mapGameVisualPipeline",
            true,
            scene,
            [camera]
          );
        }

        pipeline.fxaaEnabled = true;
        pipeline.samples = regular ? 2 : 1;
        pipeline.bloomEnabled = regular;
        pipeline.bloomThreshold = .84;
        pipeline.bloomWeight = .18;
        pipeline.bloomKernel = 42;
        pipeline.imageProcessingEnabled = true;
        pipeline.imageProcessing.contrast = regular ? 1.11 : 1.04;
        pipeline.imageProcessing.exposure = regular ? 1.04 : 1.0;
        pipeline.imageProcessing.vignetteEnabled = regular;
        pipeline.imageProcessing.vignetteWeight = .55;
        pipeline.imageProcessing.vignetteStretch = .25;
      } catch (error) {
        console.warn("Map Game visual pipeline unavailable:", error);
      }
    }

    applyPreset(runtime.graphicsPreset || "BASIC");

    window.addEventListener("mapgame:graphics", event => {
      applyPreset(event.detail && event.detail.preset || "BASIC");
    });

    if (runtime.showToast) {
      runtime.showToast("Scenic world layer loaded", "success");
    }
  }

  if (window.mapGameRuntime) {
    start(window.mapGameRuntime);
  } else {
    window.addEventListener("mapgame:runtime-ready", event => start(event.detail), { once:true });
  }
})();
