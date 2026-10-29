# Material dependency graph

Generated from the validated registry. Extractors are source nodes; money is not an industrial recipe output. Locked definitions remain marked in the catalog.

```mermaid
flowchart LR
  iron["Iron"]
  steel["Steel"]
  carbon["Carbon"]
  concrete["Concrete"]
  glass["Glass"]
  ironOre["Iron Ore"]
  coal["Coal"]
  silica["Silica"]
  limestone["Limestone"]
  copperOre["Copper Ore"]
  bauxite["Bauxite"]
  crudeOil["Crude Oil"]
  naturalGas["Natural Gas"]
  sulfur["Sulfur"]
  salt["Salt"]
  phosphate["Phosphate"]
  lithiumOre["Lithium Ore"]
  titaniumOre["Titanium Ore"]
  rareEarthOre["Rare Earth Ore"]
  copper["Copper"]
  aluminum["Aluminum"]
  fuel["Fuel"]
  industrialGas["Industrial Gas"]
  silicon["Silicon"]
  lithium["Lithium"]
  titanium["Titanium"]
  rareEarths["Rare Earths"]
  alloySteel["Alloy Steel"]
  cement["Cement"]
  bricks["Bricks"]
  beams["Beams"]
  steelPlate["Steel Plate"]
  wire["Wire"]
  cable["Cable"]
  pipes["Pipes"]
  insulation["Insulation"]
  ceramics["Ceramics"]
  constructionModules["Construction Modules"]
  plastic["Plastic"]
  rubber["Rubber"]
  industrialAcid["Industrial Acid"]
  fertilizer["Fertilizer"]
  paint["Paint"]
  lubricant["Lubricant"]
  industrialResin["Industrial Resin"]
  compositeFiber["Composite Fiber"]
  polymerFilm["Polymer Film"]
  coolant["Coolant"]
  industrialSolvent["Industrial Solvent"]
  adhesive["Adhesive"]
  syntheticTextiles["Synthetic Textiles"]
  composites["Composites"]
  semiconductors["Semiconductors"]
  circuitBoards["Circuit Boards"]
  processors["Processors"]
  memory["Memory"]
  sensors["Sensors"]
  displays["Displays"]
  batteries["Batteries"]
  powerElectronics["Power Electronics"]
  controlSystems["Control Systems"]
  communicationModules["Communication Modules"]
  precisionElectronics["Precision Electronics"]
  quantumModules["Quantum Modules"]
  tools["Tools"]
  gears["Gears"]
  motors["Motors"]
  pumps["Pumps"]
  bearings["Bearings"]
  industrialMachinery["Industrial Machinery"]
  precisionTools["Precision Tools"]
  turbines["Turbines"]
  automationModules["Automation Modules"]
  heavyMachinery["Heavy Machinery"]
  roboticArms["Robotic Arms"]
  industrialRobots["Industrial Robots"]
  chassis["Chassis"]
  engines["Engines"]
  tires["Tires"]
  vehicleParts["Vehicle Parts"]
  utilityVehicles["Utility Vehicles"]
  freightTrucks["Freight Trucks"]
  buses["Buses"]
  passengerCars["Passenger Cars"]
  electricVehicles["Electric Vehicles"]
  railAssemblies["Rail Assemblies"]
  ships["Ships"]
  autonomousVehicles["Autonomous Vehicles"]
  airframes["Airframes"]
  jetEngines["Jet Engines"]
  avionics["Avionics"]
  aerospaceComposites["Aerospace Composites"]
  aircraftParts["Aircraft Parts"]
  civilAircraft["Civil Aircraft"]
  satelliteParts["Satellite Parts"]
  satellites["Satellites"]
  launchAssemblies["Launch Assemblies"]
  orbitalPlatforms["Orbital Platforms"]
  householdGoods["Household Goods"]
  appliances["Appliances"]
  electricalGoods["Electrical Goods"]
  medicalSupplies["Medical Supplies"]
  packaging["Packaging"]
  workwear["Workwear"]
  furniture["Furniture"]
  consumerDevices["Consumer Devices"]
  medicalDevices["Medical Devices"]
  industrialConsumables["Industrial Consumables"]
  advancedAppliances["Advanced Appliances"]
  luxuryGoods["Luxury Goods"]
  protectiveEquipment["Protective Equipment"]
  fieldSupplies["Field Supplies"]
  communicationsEquipment["Communications Equipment"]
  opticalEquipment["Optical Equipment"]
  equipmentParts["Equipment Parts"]
  transportEquipment["Transport Equipment"]
  aircraftEquipment["Aircraft Equipment"]
  navalEquipment["Naval Equipment"]
  precisionEquipment["Precision Equipment"]
  strategicEquipment["Strategic Equipment"]
  chromiteOre["Chromite Ore"]
  chromium["Chromium"]
  stainlessSteel["Stainless Steel"]
  photoresist["Photoresist"]
  siliconWafers["Silicon Wafers"]
  servoDrives["Servo Drives"]
  ironOre -->|ironSmelter| iron
  iron -->|steelFoundry| steel
  carbon -->|steelFoundry| steel
  coal -->|cokeWorks| carbon
  copperOre -->|copperSmelter| copper
  bauxite -->|aluminumRefinery| aluminum
  carbon -->|aluminumRefinery| aluminum
  crudeOil -->|oilRefinery| fuel
  naturalGas -->|gasProcessor| industrialGas
  silica -->|siliconRefinery| silicon
  carbon -->|siliconRefinery| silicon
  lithiumOre -->|lithiumRefinery| lithium
  titaniumOre -->|titaniumRefinery| titanium
  carbon -->|titaniumRefinery| titanium
  rareEarthOre -->|rareEarthRefinery| rareEarths
  steel -->|alloyFoundry| alloySteel
  titanium -->|alloyFoundry| alloySteel
  limestone -->|cementKiln| cement
  carbon -->|cementKiln| cement
  cement -->|concreteBatchPlant| concrete
  silica -->|concreteBatchPlant| concrete
  silica -->|glassWorks| glass
  industrialGas -->|glassWorks| glass
  limestone -->|brickKiln| bricks
  silica -->|brickKiln| bricks
  steel -->|beamMill| beams
  steel -->|plateMill| steelPlate
  copper -->|wireMill| wire
  wire -->|cableWorks| cable
  plastic -->|cableWorks| cable
  steel -->|pipeMill| pipes
  glass -->|insulationWorks| insulation
  plastic -->|insulationWorks| insulation
  silica -->|ceramicsWorks| ceramics
  aluminum -->|ceramicsWorks| ceramics
  concrete -->|moduleWorks| constructionModules
  beams -->|moduleWorks| constructionModules
  glass -->|moduleWorks| constructionModules
  fuel -->|polymerWorks| plastic
  industrialGas -->|polymerWorks| plastic
  fuel -->|rubberWorks| rubber
  sulfur -->|rubberWorks| rubber
  sulfur -->|acidWorks| industrialAcid
  industrialGas -->|acidWorks| industrialAcid
  phosphate -->|fertilizerWorks| fertilizer
  industrialGas -->|fertilizerWorks| fertilizer
  fuel -->|paintWorks| paint
  salt -->|paintWorks| paint
  fuel -->|lubricantWorks| lubricant
  fuel -->|resinWorks| industrialResin
  industrialGas -->|resinWorks| industrialResin
  carbon -->|fiberWorks| compositeFiber
  industrialResin -->|fiberWorks| compositeFiber
  plastic -->|filmWorks| polymerFilm
  industrialGas -->|coolantWorks| coolant
  salt -->|coolantWorks| coolant
  fuel -->|solventWorks| industrialSolvent
  industrialGas -->|solventWorks| industrialSolvent
  industrialResin -->|adhesiveWorks| adhesive
  industrialSolvent -->|adhesiveWorks| adhesive
  plastic -->|textileWorks| syntheticTextiles
  industrialResin -->|textileWorks| syntheticTextiles
  compositeFiber -->|compositeWorks| composites
  industrialResin -->|compositeWorks| composites
  silicon -->|semiconductorFab| semiconductors
  industrialGas -->|semiconductorFab| semiconductors
  copper -->|boardWorks| circuitBoards
  plastic -->|boardWorks| circuitBoards
  semiconductors -->|boardWorks| circuitBoards
  semiconductors -->|processorFab| processors
  rareEarths -->|processorFab| processors
  semiconductors -->|memoryFab| memory
  circuitBoards -->|sensorWorks| sensors
  glass -->|sensorWorks| sensors
  glass -->|displayWorks| displays
  semiconductors -->|displayWorks| displays
  lithium -->|batteryWorks| batteries
  copper -->|batteryWorks| batteries
  semiconductors -->|powerElectronicsWorks| powerElectronics
  copper -->|powerElectronicsWorks| powerElectronics
  circuitBoards -->|controlWorks| controlSystems
  processors -->|controlWorks| controlSystems
  circuitBoards -->|communicationsWorks| communicationModules
  rareEarths -->|communicationsWorks| communicationModules
  sensors -->|precisionElectronicsWorks| precisionElectronics
  processors -->|precisionElectronicsWorks| precisionElectronics
  memory -->|precisionElectronicsWorks| precisionElectronics
  precisionElectronics -->|quantumModuleWorks| quantumModules
  rareEarths -->|quantumModuleWorks| quantumModules
  steel -->|toolWorks| tools
  steel -->|gearWorks| gears
  lubricant -->|gearWorks| gears
  steel -->|motorWorks| motors
  wire -->|motorWorks| motors
  steel -->|pumpWorks| pumps
  pipes -->|pumpWorks| pumps
  steel -->|bearingWorks| bearings
  lubricant -->|bearingWorks| bearings
  gears -->|machineWorks| industrialMachinery
  motors -->|machineWorks| industrialMachinery
  tools -->|machineWorks| industrialMachinery
  alloySteel -->|precisionToolWorks| precisionTools
  sensors -->|precisionToolWorks| precisionTools
  alloySteel -->|turbineWorks| turbines
  bearings -->|turbineWorks| turbines
  controlSystems -->|automationWorks| automationModules
  motors -->|automationWorks| automationModules
  industrialMachinery -->|heavyMachineWorks| heavyMachinery
  beams -->|heavyMachineWorks| heavyMachinery
  precisionTools -->|robotArmWorks| roboticArms
  automationModules -->|robotArmWorks| roboticArms
  roboticArms -->|robotWorks| industrialRobots
  precisionElectronics -->|robotWorks| industrialRobots
  beams -->|chassisWorks| chassis
  steelPlate -->|chassisWorks| chassis
  gears -->|engineWorks| engines
  bearings -->|engineWorks| engines
  steel -->|engineWorks| engines
  rubber -->|tireWorks| tires
  wire -->|tireWorks| tires
  chassis -->|vehiclePartsWorks| vehicleParts
  motors -->|vehiclePartsWorks| vehicleParts
  tires -->|vehiclePartsWorks| vehicleParts
  vehicleParts -->|utilityVehicleWorks| utilityVehicles
  engines -->|utilityVehicleWorks| utilityVehicles
  vehicleParts -->|truckWorks| freightTrucks
  engines -->|truckWorks| freightTrucks
  chassis -->|busWorks| buses
  engines -->|busWorks| buses
  glass -->|busWorks| buses
  vehicleParts -->|carWorks| passengerCars
  engines -->|carWorks| passengerCars
  glass -->|carWorks| passengerCars
  vehicleParts -->|electricVehicleWorks| electricVehicles
  batteries -->|electricVehicleWorks| electricVehicles
  powerElectronics -->|electricVehicleWorks| electricVehicles
  beams -->|railWorks| railAssemblies
  motors -->|railWorks| railAssemblies
  controlSystems -->|railWorks| railAssemblies
  steelPlate -->|shipWorks| ships
  engines -->|shipWorks| ships
  controlSystems -->|shipWorks| ships
  electricVehicles -->|autonomousVehicleWorks| autonomousVehicles
  precisionElectronics -->|autonomousVehicleWorks| autonomousVehicles
  aluminum -->|airframeWorks| airframes
  alloySteel -->|airframeWorks| airframes
  turbines -->|jetEngineWorks| jetEngines
  titanium -->|jetEngineWorks| jetEngines
  controlSystems -->|avionicsWorks| avionics
  sensors -->|avionicsWorks| avionics
  composites -->|aerospaceCompositeWorks| aerospaceComposites
  titanium -->|aerospaceCompositeWorks| aerospaceComposites
  airframes -->|aircraftPartsWorks| aircraftParts
  aerospaceComposites -->|aircraftPartsWorks| aircraftParts
  aircraftParts -->|civilAircraftWorks| civilAircraft
  jetEngines -->|civilAircraftWorks| civilAircraft
  avionics -->|civilAircraftWorks| civilAircraft
  aluminum -->|satellitePartsWorks| satelliteParts
  precisionElectronics -->|satellitePartsWorks| satelliteParts
  satelliteParts -->|satelliteWorks| satellites
  avionics -->|satelliteWorks| satellites
  aerospaceComposites -->|launchAssemblyWorks| launchAssemblies
  controlSystems -->|launchAssemblyWorks| launchAssemblies
  turbines -->|launchAssemblyWorks| launchAssemblies
  launchAssemblies -->|orbitalPlatformWorks| orbitalPlatforms
  satellites -->|orbitalPlatformWorks| orbitalPlatforms
  industrialRobots -->|orbitalPlatformWorks| orbitalPlatforms
  plastic -->|householdGoodsWorks| householdGoods
  steel -->|householdGoodsWorks| householdGoods
  motors -->|applianceWorks| appliances
  circuitBoards -->|applianceWorks| appliances
  steelPlate -->|applianceWorks| appliances
  wire -->|electricalGoodsWorks| electricalGoods
  plastic -->|electricalGoodsWorks| electricalGoods
  semiconductors -->|electricalGoodsWorks| electricalGoods
  plastic -->|medicalSupplyWorks| medicalSupplies
  industrialGas -->|medicalSupplyWorks| medicalSupplies
  glass -->|medicalSupplyWorks| medicalSupplies
  polymerFilm -->|packagingWorks| packaging
  syntheticTextiles -->|workwearWorks| workwear
  steel -->|furnitureWorks| furniture
  plastic -->|furnitureWorks| furniture
  syntheticTextiles -->|furnitureWorks| furniture
  processors -->|consumerDeviceWorks| consumerDevices
  displays -->|consumerDeviceWorks| consumerDevices
  batteries -->|consumerDeviceWorks| consumerDevices
  precisionElectronics -->|medicalDeviceWorks| medicalDevices
  ceramics -->|medicalDeviceWorks| medicalDevices
  lubricant -->|consumablesWorks| industrialConsumables
  adhesive -->|consumablesWorks| industrialConsumables
  appliances -->|advancedApplianceWorks| advancedAppliances
  controlSystems -->|advancedApplianceWorks| advancedAppliances
  consumerDevices -->|luxuryGoodsWorks| luxuryGoods
  rareEarths -->|luxuryGoodsWorks| luxuryGoods
  syntheticTextiles -->|luxuryGoodsWorks| luxuryGoods
  composites -->|protectiveEquipmentWorks| protectiveEquipment
  syntheticTextiles -->|protectiveEquipmentWorks| protectiveEquipment
  medicalSupplies -->|fieldSupplyWorks| fieldSupplies
  packaging -->|fieldSupplyWorks| fieldSupplies
  communicationModules -->|fieldCommunicationsWorks| communicationsEquipment
  batteries -->|fieldCommunicationsWorks| communicationsEquipment
  sensors -->|opticalEquipmentWorks| opticalEquipment
  glass -->|opticalEquipmentWorks| opticalEquipment
  alloySteel -->|equipmentPartsWorks| equipmentParts
  precisionTools -->|equipmentPartsWorks| equipmentParts
  utilityVehicles -->|transportEquipmentWorks| transportEquipment
  protectiveEquipment -->|transportEquipmentWorks| transportEquipment
  aircraftParts -->|aircraftEquipmentWorks| aircraftEquipment
  avionics -->|aircraftEquipmentWorks| aircraftEquipment
  ships -->|navalEquipmentWorks| navalEquipment
  communicationsEquipment -->|navalEquipmentWorks| navalEquipment
  precisionElectronics -->|precisionEquipmentWorks| precisionEquipment
  equipmentParts -->|precisionEquipmentWorks| precisionEquipment
  precisionEquipment -->|strategicEquipmentWorks| strategicEquipment
  industrialRobots -->|strategicEquipmentWorks| strategicEquipment
  satelliteParts -->|strategicEquipmentWorks| strategicEquipment
  chromiteOre -->|chromiumRefinery| chromium
  industrialAcid -->|chromiumRefinery| chromium
  steel -->|stainlessSteelWorks| stainlessSteel
  chromium -->|stainlessSteelWorks| stainlessSteel
  industrialResin -->|photoresistWorks| photoresist
  industrialSolvent -->|photoresistWorks| photoresist
  silicon -->|waferFab| siliconWafers
  photoresist -->|waferFab| siliconWafers
  siliconWafers -->|servoDriveWorks| servoDrives
  powerElectronics -->|servoDriveWorks| servoDrives
  copper -->|servoDriveWorks| servoDrives
  concrete -->|stainlessModuleWorks| constructionModules
  stainlessSteel -->|stainlessModuleWorks| constructionModules
  vehicleParts -->|electricTransportWorks| electricVehicles
  batteries -->|electricTransportWorks| electricVehicles
  servoDrives -->|electricTransportWorks| electricVehicles
  stainlessSteel -->|electricTransportWorks| electricVehicles
```
