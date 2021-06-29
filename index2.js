import {
  Actor as ActorBase,
  ActorModes,
  createCanvas, degreeToRadian,
  Simulator as SimulatorBase,
} from "./index.js";

export class Actor extends ActorBase {
  tick() {
    if (this.mode === ActorModes.RunAround) {
      const maxTurnAngle = degreeToRadian(5)
      this.fieldOfView.angle += randomFloor(-maxTurnAngle, maxTurnAngle)
    }

    super.tick()
  }
}

export class Simulator extends SimulatorBase {
  _determineActorClass(index) {
    return index < 6 ? Actor : super._determineActorClass(index)
  }
}

export function main() {
  const canvas = createCanvas()
  document.body.appendChild(canvas)
  const context = canvas.getContext('2d')

  const simulator = new Simulator(canvas, context)
  simulator.scheduleNextTick()
}

export function randomInteger(min, max) {
  min = Math.floor(min)
  max = Math.floor(max)
  return Math.floor(randomFloor(min, max))
}

export function randomFloor(min, max) {
  return min + (max - min) * Math.random()
}
