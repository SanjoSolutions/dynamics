export const ActorModes = {
  RunAround: 'RunAround',
  GatheringFood: 'GatheringFood'
}

export class GatheringFoodCoordinator {
  constructor(actors, food) {
    this.actors = actors
    this.food = food
    this.assignedFood = new WeakSet()
  }

  filterActorsGatheringFoodAndIdle() {
    return this.actors
      .filter(
        actor => (
          actor.mode === ActorModes.GatheringFood &&
          !actor.foodToGather
        )
      )
  }

  tick() {
    const actorsGatheringFoodAndIdle = this.filterActorsGatheringFoodAndIdle()
    for (const food of this.food) {
      if (!this.assignedFood.has(food)) {
        const actor = this.determineActorToGatherFood(actorsGatheringFoodAndIdle, food)
        if (actor) {
          actor.orderToGatherFood(food)
          this.assignedFood.add(food)
        }
      }
    }
  }

  determineActorToGatherFood(actors, food) {
    return getObjectWithShortestDistanceTo(actors, food)
  }
}

export class Actor {
  static RADIUS = 3 / 2
  static STEP_SIZE = 1
  static ARM_LENGTH = 3

  constructor(simulator, level, x, y, facingAngle) {
    this.simulator = simulator
    this.level = level
    this.x = x
    this.y = y
    this.color = 'black'
    this.radius = Actor.RADIUS
    this.mode = null
    this.fieldOfView = {
      angle: facingAngle,
      width: degreeToRadian(30),
      radius: 60
    }
    this.rightArmAngle = degreeToRadian(30)
    this.leftArmAngle = degreeToRadian(30)
    this.foodToGather = null
    this.pickedUpObject = null

    this.canMoveTo = this.canMoveTo.bind(this)
  }

  tick() {
    if (this.mode === ActorModes.RunAround) {
      // this.fieldOfView.angle += 0

      const movement = {
        x: Actor.STEP_SIZE * Math.cos(this.fieldOfView.angle),
        y: Actor.STEP_SIZE * Math.sin(this.fieldOfView.angle)
      }

      if (this.canMoveTo(movement) && !this.isLookingIntoWall(movement)) {
        const moveToPosition = {
          x: this.x + movement.x,
          y: this.y + movement.y
        }

        this.x = moveToPosition.x
        this.y = moveToPosition.y
      }
    } else if (this.mode === ActorModes.GatheringFood) {
      if (this.foodToGather) {
        this.fieldOfView.angle = Math.atan2(
          this.foodToGather.y - this.y,
          this.foodToGather.x - this.x
        )

        if (distance(this, this.foodToGather) < 3) {
          this.pickedUpObject = this.foodToGather
          const index = this.simulator.food.indexOf(this.foodToGather)
          if (index !== -1) {
            this.simulator.food.splice(index, 1)
          }
          this.foodToGather = null
        } else {
          const movement = {
            x: Actor.STEP_SIZE * Math.cos(this.fieldOfView.angle),
            y: Actor.STEP_SIZE * Math.sin(this.fieldOfView.angle)
          }

          if (this.canMoveTo(movement)) {
            const moveToPosition = {
              x: this.x + movement.x,
              y: this.y + movement.y
            }

            this.x = moveToPosition.x
            this.y = moveToPosition.y
          }
        }
      }
    }
  }

  canMoveTo(movement) {
    const moveToPosition = {
      x: this.x + movement.x,
      y: this.y + movement.y
    }
    return (
      moveToPosition.x > this.radius &&
      moveToPosition.x < this.simulator.canvas.width - this.radius &&
      moveToPosition.y > this.radius &&
      moveToPosition.y < this.simulator.canvas.height - this.radius &&
      !this.hasCollisionWithAnotherActor(moveToPosition)
    )
  }

  isLookingIntoWall(movement) {
    const moveToPosition = {
      x: this.x + movement.x,
      y: this.y + movement.y
    }

    const positionCenter = {
      x: moveToPosition.x + (this.radius + this.fieldOfView.radius) * Math.cos(this.fieldOfView.angle),
      y: moveToPosition.y + (this.radius + this.fieldOfView.radius) * Math.sin(this.fieldOfView.angle)
    }

    const positionLeft = {
      x: moveToPosition.x + (this.radius + this.fieldOfView.radius) * Math.cos(this.fieldOfView.angle - 0.5 * this.fieldOfView.width),
      y: moveToPosition.y + (this.radius + this.fieldOfView.radius) * Math.sin(this.fieldOfView.angle - 0.5 * this.fieldOfView.width)
    }

    const positionRight = {
      x: moveToPosition.x + (this.radius + this.fieldOfView.radius) * Math.cos(this.fieldOfView.angle + 0.5 * this.fieldOfView.width),
      y: moveToPosition.y + (this.radius + this.fieldOfView.radius) * Math.sin(this.fieldOfView.angle + 0.5 * this.fieldOfView.width)
    }

    const positions = [
      positionCenter,
      positionLeft,
      positionRight
    ]

    return positions.some(position => (
      position.x < 0 ||
      position.x > this.simulator.canvas.width - 1 ||
      position.y < 0 ||
      position.y > this.simulator.canvas.height - 1
    ))
  }

  hasCollisionWithAnotherActor(moveToPosition) {
    const otherActors = this.simulator.actors.filter(actor => actor !== this)
    return otherActors.some(
      this.hasCollisionWithOtherActor.bind(this, moveToPosition)
    )
  }

  hasCollisionWithOtherActor(moveToPosition, otherActor) {
    return distance(moveToPosition, otherActor) <= Actor.RADIUS
  }

  runAround() {
    this.mode = ActorModes.RunAround
  }

  gatherFood() {
    this.mode = ActorModes.GatheringFood
  }

  orderToGatherFood(food) {
    this.foodToGather = food
  }
}

export const PoliceActorModes = {
  Patrol: 'Patrol',
  LAPD: 'LAPD'
}

export class PoliceActor extends Actor {
  constructor(simulator, level, x, y, facingAngle) {
    super(simulator, level, x, y, facingAngle)
    this.color = 'blue'
    this.waypoints = this.createWaypoints()
    this.waypoint = null
    this.waypointAdder = 1
  }

  tick() {
    if (this.mode === PoliceActorModes.Patrol) {
      if (!this.waypoint || this.hasReachedWaypoint()) {
        this.waypoint = this.determineNextWaypoint()
      }
      this.moveTowardsWaypoint()
    } else {
      super.tick()
    }
  }

  moveTowardsWaypoint() {
    const angle = Math.atan2(
      this.waypoint.y - this.y,
      this.waypoint.x - this.x
    )
    this.fieldOfView.angle = angle
    this.x += Actor.STEP_SIZE * Math.cos(angle)
    this.y += Actor.STEP_SIZE * Math.sin(angle)
  }

  hasReachedWaypoint() {
    return distance(this, this.waypoint) < 3
  }

  determineNextWaypoint() {
    let nextWaypoint
    if (this.waypoint) {
      const waypointIndex = this.waypoints.indexOf(this.waypoint)
      if (
        (this.waypointAdder === 1 && waypointIndex === this.waypoints.length - 1) ||
        (this.waypointAdder === -1 && waypointIndex === 0)
      ) {
        this.waypointAdder *= -1
      }
      const nextWaypointIndex = waypointIndex + this.waypointAdder
      nextWaypoint = this.waypoints[nextWaypointIndex]
    } else {
      nextWaypoint = this.determineClosestWaypoint(this.waypoints)
    }
    return nextWaypoint
  }

  createWaypoints() {
    const waypoints = []
    for (
      let row = 1;
      row * (this.radius + this.fieldOfView.radius) < this.simulator.canvas.height;
      row++
    ) {
      const y = row * (this.radius + this.fieldOfView.radius)
      let x1
      let x2
      if (row % 2 === 1) {
        x1 = this.radius + this.fieldOfView.radius
        x2 = this.simulator.canvas.width - (this.radius + this.fieldOfView.radius)
      } else {
        x1 = this.simulator.canvas.width - (this.radius + this.fieldOfView.radius)
        x2 = this.radius + this.fieldOfView.radius
      }
      waypoints.push({
        x: x1,
        y
      })
      waypoints.push({
        x: x2,
        y
      })
    }
    return waypoints
  }

  determineClosestWaypoint(waypoints) {
    return getObjectWithShortestDistanceTo(waypoints, this)
  }

  patrol() {
    this.mode = PoliceActorModes.Patrol
  }

  lapd() {
    this.mode = PoliceActorModes.LAPD
  }
}

export function getObjectWithShortestDistanceTo(objects, to) {
  if (objects.length === 0) {
    return null
  }
  return min(
      objects
        .map(object => ({
          object,
          distance: distance(to, object)
        })),
      ({distance}) => distance
    ).object
}

export function min(values, predicate) {
  let minimum = null
  for (const value of values) {
    if (minimum === null || predicate(value) < predicate(minimum)) {
      minimum = value
    }
  }
  return minimum
}

export class Food {
  constructor(level, x, y) {
    this.level = level
    this.x = x
    this.y = y
  }
}

export function degreeToRadian(value) {
  return value * (2 * Math.PI / 360)
}

export function distance(a, b) {
  return Math.sqrt(
    (b.x - a.x) ** 2 +
    (b.y - a.y) ** 2
  )
}

export class Level {

}

export class Simulator {
  constructor(canvas, context) {
    this.canvas = canvas
    this.context = context

    this.renderFood = this.renderFood.bind(this)
    this.renderActor = this.renderActor.bind(this)
    this.onTick = this.onTick.bind(this)
    this.isOnCurrentLevel = this.isOnCurrentLevel.bind(this)

    this.levels = [
      new Level(),
      new Level()
    ]
    this.currentLevel = this.levels[0]
    this.food = [
      new Food(this.currentLevel, canvas.width / 2, canvas.height / 2)
    ]
    this.actors = []
    const center = {
      x: canvas.width / 2,
      y: canvas.height / 2
    }
    const radius = 10
    const numberOfActors = 8
    for (let i = 0; i < numberOfActors; i++) {
      const angle = i * (2 * Math.PI / numberOfActors)
      const ActorClass = this._determineActorClass(i)
      this.actors.push(new ActorClass(
        this,
        this.currentLevel,
        center.x + radius * Math.cos(angle),
        center.y + radius * Math.sin(angle),
        angle
      ))
    }
    this.actors.forEach(actor => {
      if (actor instanceof PoliceActor) {
        actor.patrol()
      } else {
        actor.gatherFood()
      }
    })

    this.coordinators = {
      GatheringFood: new GatheringFoodCoordinator(this.actors, this.food)
    }

    window.addEventListener('keyup', (event) => {
      if (event.code === 'ArrowUp') {
        const currentLevelIndex = this.levels.indexOf(this.currentLevel)
        if (currentLevelIndex < this.levels.length - 1) {
          this.currentLevel = this.levels[currentLevelIndex + 1]
        }
        event.preventDefault()
      } else if (event.code === 'ArrowDown') {
        const currentLevelIndex = this.levels.indexOf(this.currentLevel)
        if (currentLevelIndex > 0) {
          this.currentLevel = this.levels[currentLevelIndex - 1]
        }
        event.preventDefault()
      }
    })
  }

  _determineActorClass(index) {
    return index < 6 ? Actor : PoliceActor
  }

  onTick() {
    Object.values(this.coordinators).forEach(coordinator => coordinator.tick())
    this.actors.forEach(actor => actor.tick())
    this.render()
    this.scheduleNextTick()
  }

  render() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.filterEntitiesOnCurrentLevel(this.food).forEach(this.renderFood)
    this.filterEntitiesOnCurrentLevel(this.actors).forEach(this.renderActor)
  }

  filterEntitiesOnCurrentLevel(entities) {
    return entities.filter(this.isOnCurrentLevel)
  }

  isOnCurrentLevel(entity) {
    return entity.level === this.currentLevel
  }

  renderFood(food) {
    this.context.beginPath()
    this.context.fillStyle = 'green'
    this.context.arc(food.x, food.y, 1, 0, 2 * Math.PI)
    this.context.fill()
  }

  renderActor(actor) {
    this.renderActorAwarenessArea(actor)
    this.renderActorFieldOfView(actor)

    this.context.beginPath()
    this.context.fillStyle = actor.color
    this.context.arc(actor.x, actor.y, actor.radius, 0, 2 * Math.PI)
    this.context.fill()

    this.renderActorArms(actor)
  }

  renderActorArms(actor) {
    this.context.beginPath()
    this.context.strokeStyle = 'black'
    const angle = actor.fieldOfView.angle + degreeToRadian(90) - actor.rightArmAngle
    this.context.moveTo(
      actor.x + actor.radius * Math.cos(angle),
      actor.y + actor.radius * Math.sin(angle)
    )
    this.context.lineTo(
      actor.x + (actor.radius + Actor.ARM_LENGTH) * Math.cos(angle),
      actor.y + (actor.radius + Actor.ARM_LENGTH) * Math.sin(angle)
    )
    this.context.stroke()

    this.context.beginPath()
    this.context.strokeStyle = 'black'
    const angle2 = actor.fieldOfView.angle - degreeToRadian(90) + actor.leftArmAngle
    this.context.moveTo(
      actor.x + actor.radius * Math.cos(angle2),
      actor.y + actor.radius * Math.sin(angle2)
    )
    this.context.lineTo(
      actor.x + (actor.radius + Actor.ARM_LENGTH) * Math.cos(angle2),
      actor.y + (actor.radius + Actor.ARM_LENGTH) * Math.sin(angle2)
    )
    this.context.stroke()
  }

  renderActorFieldOfView(actor) {
    this.context.beginPath()
    this.context.moveTo(actor.x, actor.y)
    this.context.strokeStyle = 'black'
    this.context.lineWidth = 1
    this.context.arc(
      actor.x,
      actor.y,
      actor.radius + actor.fieldOfView.radius,
      actor.fieldOfView.angle - 0.5 * actor.fieldOfView.width,
      actor.fieldOfView.angle + 0.5 * actor.fieldOfView.width
    )
    this.context.lineTo(actor.x, actor.y)
    this.context.stroke()
  }

  renderActorAwarenessArea(actor) {
    this.context.beginPath()
    this.context.strokeStyle = 'green'
    this.context.arc(
      actor.x,
      actor.y,
      actor.radius + actor.fieldOfView.radius,
      0,
      2 * Math.PI
    )
    this.context.stroke()
  }

  scheduleNextTick() {
    requestAnimationFrame(this.onTick)
  }
}

export function main() {
  const canvas = createCanvas()
  document.body.appendChild(canvas)
  const context = canvas.getContext('2d')

  const simulator = new Simulator(canvas, context)
  simulator.scheduleNextTick()
}

export function createCanvas() {
  const canvas = document.createElement('canvas')
  canvas.width = 1280
  canvas.height = 480
  return canvas
}
