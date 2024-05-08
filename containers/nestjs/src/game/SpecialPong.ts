import {
  APong,
  Ball,
  Player,
  Pos,
  Rect,
  Sides,
  Size,
  Velocity,
  WINDOW_HEIGHT,
  WINDOW_WIDTH,
} from './APong';

abstract class Item extends Rect {
  constructor(x: number, y: number, c: string) {
    super(Item.standardSize.w, Item.standardSize.h, x, y, c);
  }

  collidesWithBall(ball: Ball): boolean {
    if (
      this.left <= ball.right &&
      this.right >= ball.left &&
      this.bottom >= ball.top &&
      this.top <= ball.bottom
    ) {
      return true;
    }
    return false;
  }

  static standardSize: Size = { w: 35, h: 35 };

  static generateRandomPos(): Pos {
    const xMinCeiled = Math.ceil(WINDOW_WIDTH / 3);
    const xMaxFloored = Math.floor(
      (WINDOW_WIDTH / 3) * 2 - Item.standardSize.w,
    );
    const x = Math.random() * (xMaxFloored - xMinCeiled) + xMinCeiled;
    const y = Math.random() * (WINDOW_HEIGHT - Item.standardSize.h);
    return { x, y };
  }

  abstract onItemPickup(itemOwnerId: number): void;
  abstract hookFunction(game: APong): boolean;
  abstract onPaddleHit(game: APong): boolean;
  abstract onItemEnd(game: APong): void;
}

// Item Ideas:
// V Reverse opponent controls for a few rounds
// - Ball invisible from pickup to first bounce
// - Split ball into 2 (one back on forward), can only spawn on opponent side and persists until end of round
// - Move opponent a little bit forward for a few rounds
// - Make opponent paddle a bit smaller for a few rounds

class ReverseControlItem extends Item {
  constructor(x: number, y: number) {
    super(x, y, 'purple');
  }

  private _affectedPlayerId: number;
  private _remainingTurns: number = 3;

  onItemPickup(itemOwnerId: number): void {
    // Set affectedPlayerId to opponent id
    this._affectedPlayerId = 1 - itemOwnerId;
  }

  hookFunction(game: APong): boolean {
    if (game._leftPlayer.id === this._affectedPlayerId) {
      game._leftPlayer.paddle._color = 'purple';
      game._leftPlayer.paddle.dyNorth = Math.max(
        game._leftPlayer.paddle.dyNorth * -1,
        game._leftPlayer.paddle.dyNorth,
      );
      game._leftPlayer.paddle.dySouth = Math.min(
        game._leftPlayer.paddle.dySouth * -1,
        game._leftPlayer.paddle.dySouth,
      );
    } else {
      game._rightPlayer.paddle._color = 'purple';
      game._rightPlayer.paddle.dyNorth = Math.max(
        game._rightPlayer.paddle.dyNorth * -1,
        game._rightPlayer.paddle.dyNorth,
      );
      game._rightPlayer.paddle.dySouth = Math.min(
        game._rightPlayer.paddle.dySouth * -1,
        game._rightPlayer.paddle.dySouth,
      );
    }
    return true;
  }

  onPaddleHit(game: APong): boolean {
    if (game._leftPlayer.id === this._affectedPlayerId) {
      if (game.collidedWithBorder === Sides.LeftPaddle) {
        this._remainingTurns--;
      }
    } else {
      if (game.collidedWithBorder === Sides.RightPaddle) {
        this._remainingTurns--;
      }
    }
    return !!this._remainingTurns;
  }

  onItemEnd(game: APong): void {
    if (game._leftPlayer.id === this._affectedPlayerId) {
      game._leftPlayer.paddle._color = 'white';
    } else {
      game._rightPlayer.paddle._color = 'white';
    }
  }
}

export default class SpecialPong extends APong {
  constructor(winScore: number) {
    super(winScore);
    this.type = 'special';
  }

  private _lastBallDirection: Velocity = new Velocity(0, 0);
  private _itemsOnMap: Array<Item> = [];
  private _itemsPickedUp: Array<Item> = [];

  update() {
    this._lastBallDirection._dx = this._ball._vel._dx;
    this._lastBallDirection._dy = this._ball._vel._dy;

    // Update the ball position
    this._ball.updatePos();

    // Check if any items were picked up
    for (let i: number = 0; i < this._itemsOnMap.length; i++) {
      const item: Item = this._itemsOnMap[i];
      if (item.collidesWithBall(this._ball)) {
        // Decides who should be the item owner
        const id = this._ball._vel.dx > 0 ? 0 : 1;
        item.onItemPickup(id);
        this._itemsPickedUp.push(item);
        this._itemsOnMap.splice(i, i + 1);
        // To accommodate for the i++ that happens in the for loop while all the items gets pushed to the left because of the splice()
        i--;
      }
    }

    // Do item effects of picked up items
    for (let i: number = 0; i < this._itemsPickedUp.length; i++) {
      const item: Item = this._itemsPickedUp[i];
      const doesItemContinue: boolean = item.hookFunction(this);
      if (!doesItemContinue) {
        item.onItemEnd(this);
        this._itemsPickedUp.splice(i, i + 1);
        // To accommodate for the i++ that happens in the for loop while all the items gets pushed to the left because of the splice()
        i--;
      }
    }

    // Update player paddles positions
    this._leftPlayer.update();
    this._rightPlayer.update();

    // Check if the ball colided with a player
    this.collidedWithBorder = this._ball.collide(
      this._leftPlayer,
      this._rightPlayer,
    );
    if (this.collidedWithBorder == Sides.Left) {
      this._rightPlayer.addPoint();
      this.reset();
      return;
    } else if (this.collidedWithBorder == Sides.Right) {
      this._leftPlayer.addPoint();
      this.reset();
      return;
    }

    // If ball hits paddle
    if (
      this.collidedWithBorder === Sides.LeftPaddle ||
      this.collidedWithBorder === Sides.RightPaddle
    ) {
      // Apply item onPaddleHit function
      for (let i: number = 0; i < this._itemsPickedUp.length; i++) {
        const item: Item = this._itemsPickedUp[i];
        const doesItemContinue: boolean = item.onPaddleHit(this);
        if (!doesItemContinue) {
          item.onItemEnd(this);
          this._itemsPickedUp.splice(i, i + 1);
          // To accommodate for the i++ that happens in the for loop while all the items gets pushed to the left because of the splice()
          i--;
        }
      }
      // 1/4 chance to spawn an item
      if (Math.random() <= 0.25) {
        const pos = Item.generateRandomPos();
        this._itemsOnMap.push(new ReverseControlItem(pos.x, pos.y));
      }
    }
  }

  getData() {
    let rects: Array<any> = [];
    rects.push({
      color: this._leftPlayer.paddle._color,
      pos: this._leftPlayer.paddle._pos,
      size: this._leftPlayer.paddle._size,
    });
    rects.push({
      color: this._rightPlayer.paddle._color,
      pos: this._rightPlayer.paddle._pos,
      size: this._rightPlayer.paddle._size,
    });
    rects.push({
      color: this._ball._color,
      pos: this._ball._pos,
      size: this._ball._size,
    });
    for (const item of this._itemsOnMap) {
      rects.push({
        color: item._color,
        pos: item._pos,
        size: item._size,
      });
    }
    return {
      rects,
      score: {
        leftPlayer: this._leftPlayer._score,
        rightPlayer: this._rightPlayer._score,
      },
    };
  }

  reset(): void {
    this._ball.reset();
    this._lastBallDirection._dx = 0;
    this._lastBallDirection._dy = 0;
    this._itemsOnMap = [];
    this._itemsPickedUp = [];
    this.collidedWithBorder = Sides.None;
  }
}
