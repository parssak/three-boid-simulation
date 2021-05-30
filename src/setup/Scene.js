import * as THREE from 'three';
import CameraController from './CameraController'

export default class Scene {
  constructor() {
    // All Entities in Scene
    this.entities = [];

    // Scene
    this.scene = new THREE.Scene();

    // Camera Controller
    this.cameraController = new CameraController(this.scene);

    this.SetupScene()

    // Run the Update loop
    this.cameraController.renderer.setAnimationLoop(time => this.Update(time))
  }

  /** Include any Scene setup logic here */
  SetupScene() {
    const ambientLight = new THREE.AmbientLight(0xffffff);
    // ambientLight.intensity = 1;
    this.scene.add(ambientLight);
    
    const color = 0xFFFFFF;
    const intensity = 1;
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(0, 10, 0);
    light.target.position.set(-5, 0, 0);
    this.scene.add(light);

    this.scene.fog = new THREE.Fog(0xa0a0a0, 10, 50);
  }

  /**
   * Adds a new mesh to the scene.
   * @param {THREE.Mesh} mesh New Mesh to add to scene
   */
  Add(entity) {
    if (entity.mesh) {
      this.scene.add(entity.mesh)
      this.entities.push(entity)
    }
    else if (entity.group) {
      this.scene.add(entity.group)
      this.entities.push(entity)
    }
  }

  /**
   * Runs once per frame, call's Update for each entity
   * @param {float} time Time since the Scene began
   */
  Update(time) {
    this.entities.forEach(entity => !entity.inGroup && entity.Update(time));
    this.cameraController.Update()
  }
}