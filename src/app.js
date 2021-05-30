import Entity from './setup'

const getRandomNum = (max = 0, min = 0) => Math.floor(Math.random() * (max + 1 - min)) + min;

class Agent extends Entity {
    constructor() {
        super({inGroup: true});
        this.velocity = new THREE.Vector3(getRandomNum(100, -100) * 0.1, getRandomNum(100, -100) * 0.1, getRandomNum(100, -100) * 0.1);
        this.acceleration = new THREE.Vector3();
        this.wonderTheta = 0;
        this.maxSpeed = 1;
        this.boost = new THREE.Vector3();
    }

    BuildMesh() {
        this.geometry = new THREE.CylinderGeometry(0, 4, 8, 10);
        this.geometry.rotateX(THREE.Math.degToRad(90))
        this.material = new THREE.MeshNormalMaterial();
        this.mesh = new THREE.Mesh(this.geometry, this.material);
    }

    Start() {
        super.Start();
        const radius = getRandomNum(0, 100);
        const theta = THREE.Math.degToRad(getRandomNum(180));
        const phi = THREE.Math.degToRad(getRandomNum(360));
        this.mesh.position.x = Math.sin(theta) * Math.cos(phi) * radius;
        this.mesh.position.y = Math.sin(theta) * Math.sin(phi) * radius;
        this.mesh.position.z = Math.cos(theta) * radius;
    }

    Update(time) {
        const maxSpeed = this.maxSpeed;

        // boost
        this.ApplyForce(this.boost);
        this.boost.multiplyScalar(0.9);
        if (this.boost.length() < 0.01) {
            this.boost = new THREE.Vector3();
        }

        // update velocity
        this.velocity.add(this.acceleration);

        // limit velocity
        if (this.velocity.length() > maxSpeed) {
            this.velocity.clampLength(0, maxSpeed);
        }

        // update position
        this.mesh.position.add(this.velocity);

        // reset acc
        this.acceleration.multiplyScalar(0);

        // head
        const head = this.velocity.clone();
        head.multiplyScalar(10);
        head.add(this.mesh.position);
        this.mesh.lookAt(head);

        super.Update(time)
    }

    ApplyForce(f) {
        this.acceleration.add(f.clone());
    }

}


class Boid extends Entity {
    constructor() {
        super();
        this.params = {
            maxSpeed: 7,
            seek: {
                maxForce: 0.04
            },
            align: {
                effectiveRange: 85,
                maxForce: 0.16
            },
            separate: {
                effectiveRange: 70,
                maxForce: 0.2
            },
            cohesion: {
                effectiveRange: 200
            }
        };
    }

    BuildMesh() {
        this.group = new THREE.Group();
        this.count = 50;
        this.agents = [];

        for (let i = 0; i < this.count; i++) {
            const agent = new Agent();
            this.group.add(agent.mesh);
            this.agents.push(agent);
        }
    }

    Start() {
        super.Start();
    }

    Update() {
        this.agents.forEach(agent => {
            agent.ApplyForce(this.Align(agent));
            agent.ApplyForce(this.Separate(agent));
            agent.ApplyForce(this.Cohesion(agent));
            agent.ApplyForce(this.AvoidBoxContainer(agent, 300, 300, 300));
            agent.Update();
        });
        super.Update();
    }

    Align(currAgent) {
        const sumVec = new THREE.Vector3();
        let count = 0;
        const maxSpeed = this.params.maxSpeed;;
        const maxForce = this.params.align.maxForce;
        const effectiveRange = this.params.align.effectiveRange;
        const steer = new THREE.Vector3();

        this.agents.forEach(otherAgent => {
            const dist = currAgent.mesh.position.distanceTo(otherAgent.mesh.position);
            if (dist > 0 && dist < effectiveRange) {
                sumVec.add(otherAgent.velocity);
                count++;
            }
        });

        if (count > 0) {
            sumVec.divideScalar(count);
            sumVec.normalize();
            sumVec.multiplyScalar(maxSpeed);

            steer.subVectors(sumVec, currAgent.velocity);
            if (steer.length() > maxForce) {
                steer.clampLength(0, maxForce);
            }
        }

        return steer;
    }

    Separate(currAgent) {
        const sumVec = new THREE.Vector3();
        let count = 0;
        const maxSpeed = this.params.maxSpeed;
        const maxForce = this.params.separate.maxForce;
        const effectiveRange = this.params.separate.effectiveRange;
        const steer = new THREE.Vector3();

        this.agents.forEach(otherAgent => {
            const dist = currAgent.mesh.position.distanceTo(otherAgent.mesh.position);
            if (dist > 0 && dist < effectiveRange) {
                let closeVec = new THREE.Vector3();
                closeVec.subVectors(currAgent.mesh.position, otherAgent.mesh.position);
                closeVec.normalize();
                closeVec.divideScalar(dist);
                sumVec.add(closeVec);
                count++;
            }
        });

        if (count > 0) {
            sumVec.divideScalar(count);
            sumVec.normalize();
            sumVec.multiplyScalar(maxSpeed);

            steer.subVectors(sumVec, currAgent.velocity);
            if (steer.length() > maxForce) {
                steer.clampLength(0, maxForce);
            }
        }

        return steer;
    }

    Seek(currAgent, target = new THREE.Vector3()) {
        const maxSpeed = this.params.maxSpeed;;
        const maxForce = this.params.seek.maxForce;
        const toGoalVector = new THREE.Vector3();
        toGoalVector.subVectors(target, currAgent.mesh.position);
        toGoalVector.normalize();
        toGoalVector.multiplyScalar(maxSpeed);
        const steer = new THREE.Vector3();
        steer.subVectors(toGoalVector, currAgent.velocity);
        if (steer.length() > maxForce) {
            steer.clampLength(0, maxForce);
        }
        return steer;
    }

    Cohesion(currAgent) {
        const sumVec = new THREE.Vector3();
        let count = 0;
        const effectiveRange = this.params.cohesion.effectiveRange;
        const steer = new THREE.Vector3();

        this.agents.forEach((otherAgent) => {
            const dist = currAgent.mesh.position.distanceTo(otherAgent.mesh.position);
            if (dist > 0 && dist < effectiveRange) {
                sumVec.add(otherAgent.mesh.position);
                count++;
            }
        })

        if (count > 0) {
            sumVec.divideScalar(count);
            steer.add(this.Seek(currAgent, sumVec));
        }

        return steer;
    }

    Avoid(currAgent, wall = new THREE.Vector3()) {
        currAgent.mesh.geometry.computeBoundingSphere();
        const boundingSphere = currAgent.mesh.geometry.boundingSphere;

        const closeVec = new THREE.Vector3();
        closeVec.subVectors(currAgent.mesh.position, wall);

        const distance = closeVec.length() - boundingSphere.radius * 2;
        const steer = closeVec.clone();
        steer.normalize();
        steer.multiplyScalar(1 / (Math.pow(distance, 2)));
        return steer;
    }

    AvoidBoxContainer(currAgent, rangeWidth = 80, rangeHeight = 80, rangeDepth = 80) {
        const sumVec = new THREE.Vector3();
        sumVec.add(this.Avoid(currAgent, new THREE.Vector3(rangeWidth, currAgent.mesh.position.y, currAgent.mesh.position.z)));
        sumVec.add(this.Avoid(currAgent, new THREE.Vector3(-rangeWidth, currAgent.mesh.position.y, currAgent.mesh.position.z)));
        sumVec.add(this.Avoid(currAgent, new THREE.Vector3(currAgent.mesh.position.x, rangeHeight, currAgent.mesh.position.z)));
        sumVec.add(this.Avoid(currAgent, new THREE.Vector3(currAgent.mesh.position.x, -rangeHeight, currAgent.mesh.position.z)));
        sumVec.add(this.Avoid(currAgent, new THREE.Vector3(currAgent.mesh.position.x, currAgent.mesh.position.y, rangeDepth)));
        sumVec.add(this.Avoid(currAgent, new THREE.Vector3(currAgent.mesh.position.x, currAgent.mesh.position.y, -rangeDepth)));
        sumVec.multiplyScalar(Math.pow(currAgent.velocity.length(), 3));
        return sumVec;
    }

}

new Boid();

window.addEventListener('mousedown', () => {
    document.getElementById('description').className = "dimmed"
})
window.addEventListener('mouseup', () => document.getElementById('description').className = "")



