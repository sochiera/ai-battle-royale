(function () {
  window.ZFG = window.ZFG || {};
  ZFG.games = ZFG.games || {};

  var W = 800;
  var H = 480;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  class Pong extends ZFG.Game {
    constructor(container, opts) {
      opts = opts || {};
      opts.id = 'pong';
      super(container, opts);

      this.statusEl = opts.status || null;
      this.room = null;
      this.isHost = false;

      this.width = W;
      this.height = H;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);

      this.paddleW = 12;
      this.paddleH = 92;
      this.paddleMargin = 24;
      this.paddleSpeed = 640;

      this.leftY = H / 2 - this.paddleH / 2;
      this.rightY = H / 2 - this.paddleH / 2;
      this.leftTarget = this.leftY;
      this.rightTarget = this.rightY;

      this.ball = { x: W / 2, y: H / 2, r: 9, vx: 0, vy: 0 };
      this.ballSpeed = 380;

      this.score = { left: 0, right: 0 };
      this.winScore = 5;
      this.over = false;

      this.keys = { up: false, down: false };
      this.lastSend = 0;
      this.lastBroadcast = 0;

      this.canvas = document.createElement('canvas');
      this.canvas.className = 'game-canvas';
      this.canvas.width = W * this.dpr;
      this.canvas.height = H * this.dpr;
      this.ctx = this.canvas.getContext('2d');

      this._onPointerMove = this._onPointerMove.bind(this);
      this._onKeyDown = this._onKeyDown.bind(this);
      this._onKeyUp = this._onKeyUp.bind(this);
      this._loop = this._loop.bind(this);
    }

    init() {
      this.container.insertBefore(this.canvas, this.overlay);
      this.canvas.addEventListener('pointermove', this._onPointerMove);
      window.addEventListener('keydown', this._onKeyDown);
      window.addEventListener('keyup', this._onKeyUp);
      this.resetBall(Math.random() < 0.5 ? -1 : 1);
      this.draw();
      this.updateHud();
    }

    attach(room) {
      var self = this;
      this.room = room;
      this.isHost = room.isHost;

      room.on('state', function (state) {
        if (self.isHost) return;
        self.applyState(state);
      });

      room.on('event', function (message) {
        if (!message) return;
        if (message.type === 'paddle') {
          if (self.isHost && message.data) {
            self.rightTarget = clamp(message.data.y, 0, H - self.paddleH);
          }
        } else if (message.type === 'restart') {
          self.resetMatch();
        }
      });

      room.on('closed', function (data) {
        self.stop();
        self.showOverlay({
          title: 'Pokój zamknięty',
          text: data.reason || 'Drugi gracz wyszedł.',
          actions: [{ label: 'Zagraj ponownie', primary: true, onClick: function () { window.location.reload(); } }]
        });
      });
    }

    _start() {
      this.resetMatch();
      this.last = performance.now();
      requestAnimationFrame(this._loop);
    }

    _stop() {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
    }

    _pause() {
      this.showOverlay({
        title: 'Pauza',
        text: this.score.left + ' : ' + this.score.right,
        actions: [{ label: 'Wznów', primary: true, onClick: () => this.resume() }]
      });
    }

    _resume() {
      this.last = performance.now();
    }

    _restart() {
      if (this.isHost) {
        this.resetMatch();
        this.room.sendEvent('restart');
      }
    }

    _destroy() {
      if (this.sendTimer) clearTimeout(this.sendTimer);
      this.canvas.removeEventListener('pointermove', this._onPointerMove);
      window.removeEventListener('keydown', this._onKeyDown);
      window.removeEventListener('keyup', this._onKeyUp);
    }

    resetMatch() {
      this.score = { left: 0, right: 0 };
      this.over = false;
      this.leftY = H / 2 - this.paddleH / 2;
      this.rightY = H / 2 - this.paddleH / 2;
      this.leftTarget = this.leftY;
      this.rightTarget = this.rightY;
      this.ballSpeed = 380;
      this.resetBall(Math.random() < 0.5 ? -1 : 1);
      this.hideOverlay();
      this.updateHud();
      this.draw();
    }

    resetBall(direction) {
      this.ball.x = W / 2;
      this.ball.y = H / 2;
      this.ball.vx = direction * this.ballSpeed;
      this.ball.vy = (Math.random() * 2 - 1) * 180;
    }

    _loop(now) {
      if (!this.running) return;
      if (this.paused) {
        this.last = now;
        this.raf = requestAnimationFrame(this._loop);
        return;
      }

      var dt = Math.min((now - this.last) / 1000, 0.05);
      this.last = now;

      if (this.isHost) {
        this.simulate(dt);
        if (now - this.lastBroadcast > 28) {
          this.lastBroadcast = now;
          this.broadcast();
        }
      }

      this.draw();
      this.raf = requestAnimationFrame(this._loop);
    }

    simulate(dt) {
      this.handleKeyboard(dt);

      this.leftY += clamp(this.leftTarget - this.leftY, -this.paddleSpeed * dt, this.paddleSpeed * dt);
      this.rightY += clamp(this.rightTarget - this.rightY, -this.paddleSpeed * dt, this.paddleSpeed * dt);
      this.leftY = clamp(this.leftY, 0, H - this.paddleH);
      this.rightY = clamp(this.rightY, 0, H - this.paddleH);

      if (this.over) return;

      var ball = this.ball;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      if (ball.y - ball.r < 0) {
        ball.y = ball.r;
        ball.vy = Math.abs(ball.vy);
      } else if (ball.y + ball.r > H) {
        ball.y = H - ball.r;
        ball.vy = -Math.abs(ball.vy);
      }

      var leftX = this.paddleMargin;
      var rightX = W - this.paddleMargin - this.paddleW;

      if (ball.vx < 0 && ball.x - ball.r <= leftX + this.paddleW && ball.x > leftX && this.withinPaddle(ball.y, this.leftY)) {
        this.bounce(leftX + this.paddleW + ball.r, this.leftY, 1);
      } else if (ball.vx > 0 && ball.x + ball.r >= rightX && ball.x < rightX + this.paddleW && this.withinPaddle(ball.y, this.rightY)) {
        this.bounce(rightX - ball.r, this.rightY, -1);
      }

      if (ball.x + ball.r < 0) {
        this.score.right++;
        this.afterPoint(-1);
      } else if (ball.x - ball.r > W) {
        this.score.left++;
        this.afterPoint(1);
      }
    }

    withinPaddle(ballY, paddleY) {
      return ballY >= paddleY - this.ball.r && ballY <= paddleY + this.paddleH + this.ball.r;
    }

    bounce(x, paddleY, direction) {
      var offset = clamp((this.ball.y - (paddleY + this.paddleH / 2)) / (this.paddleH / 2), -1, 1);
      var angle = offset * (Math.PI / 3);
      this.ballSpeed = Math.min(this.ballSpeed + 26, 900);
      this.ball.x = x;
      this.ball.vx = direction * Math.cos(angle) * this.ballSpeed;
      this.ball.vy = Math.sin(angle) * this.ballSpeed;
    }

    afterPoint(direction) {
      this.updateHud();
      if (this.score.left >= this.winScore || this.score.right >= this.winScore) {
        this.endMatch();
        return;
      }
      this.resetBall(direction);
    }

    endMatch() {
      this.over = true;
      this.broadcast();
      this.showResult();
    }

    showResult() {
      var iWon = this.isHost ? this.score.left > this.score.right : this.score.right > this.score.left;
      var title = iWon ? 'Wygrałeś!' : 'Przegrałeś';
      var text = this.score.left + ' : ' + this.score.right;

      if (this.isHost) {
        this.showOverlay({
          title: title,
          text: text,
          actions: [{
            label: 'Zagraj ponownie',
            primary: true,
            onClick: () => {
              this.resetMatch();
              this.room.sendEvent('restart');
            }
          }]
        });
      } else {
        this.showOverlay({
          title: title,
          text: text + ' Czekam na hosta...'
        });
      }
      this.updateHud();
    }

    broadcast() {
      if (!this.room) return;
      this.room.sendState({
        ball: { x: this.ball.x, y: this.ball.y },
        left: this.leftY,
        right: this.rightY,
        score: this.score,
        over: this.over
      });
    }

    applyState(state) {
      if (!state) return;
      if (state.ball) {
        this.ball.x = state.ball.x;
        this.ball.y = state.ball.y;
      }
      if (typeof state.left === 'number') this.leftY = state.left;
      if (typeof state.right === 'number') this.rightY = state.right;
      if (state.score) this.score = state.score;

      if (state.over && !this.over) {
        this.over = true;
        this.showResult();
      }
      this.updateHud();
    }

    handleKeyboard(dt) {
      var delta = 0;
      if (this.keys.up) delta -= this.paddleSpeed * dt;
      if (this.keys.down) delta += this.paddleSpeed * dt;
      if (!delta) return;

      if (this.isHost) {
        this.leftTarget = clamp(this.leftTarget + delta, 0, H - this.paddleH);
      } else {
        this.rightTarget = clamp(this.rightTarget + delta, 0, H - this.paddleH);
        this.sendPaddle(this.rightTarget);
      }
    }

    _onPointerMove(event) {
      if (!this.running || this.paused) return;
      var rect = this.canvas.getBoundingClientRect();
      var y = (event.clientY - rect.top) / rect.height * H;
      var target = clamp(y - this.paddleH / 2, 0, H - this.paddleH);

      if (this.isHost) {
        this.leftTarget = target;
      } else {
        this.rightTarget = target;
        this.sendPaddle(target);
      }
    }

    sendPaddle(y) {
      if (!this.room || this.isHost) return;
      var self = this;
      this.pendingY = y;
      var now = performance.now();
      if (now - this.lastSend < 40) {
        if (!this.sendTimer) {
          this.sendTimer = setTimeout(function () {
            self.sendTimer = null;
            self.lastSend = performance.now();
            self.room.sendEvent('paddle', { y: self.pendingY });
          }, 40);
        }
        return;
      }
      this.lastSend = now;
      this.room.sendEvent('paddle', { y: y });
    }

    _onKeyDown(event) {
      if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
        event.preventDefault();
        this.keys.up = true;
      } else if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
        event.preventDefault();
        this.keys.down = true;
      }
    }

    _onKeyUp(event) {
      if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') this.keys.up = false;
      if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') this.keys.down = false;
    }

    updateHud() {
      if (!this.hudEl) return;
      var leftName = 'Gracz 1';
      var rightName = 'Gracz 2';
      if (this.room) {
        this.room.players.forEach(function (player) {
          if (player.id === this.room.hostId) leftName = player.name;
          else rightName = player.name;
        }, this);
      }
      this.hudEl.innerHTML = '';
      this.hudEl.appendChild(this.stat(leftName + (this.isHost ? ' (Ty)' : ''), this.score.left));
      this.hudEl.appendChild(this.stat(rightName + (!this.isHost ? ' (Ty)' : ''), this.score.right));

      if (this.statusEl) {
        this.statusEl.textContent = this.isHost ? 'Sterujesz lewą paletką' : 'Sterujesz prawą paletką';
      }
    }

    draw() {
      var ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.fillStyle = '#0a0e14';
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.setLineDash([10, 14]);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.font = '700 68px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(this.score.left), W / 2 - 90, 78);
      ctx.fillText(String(this.score.right), W / 2 + 90, 78);

      ctx.fillStyle = '#6ea8ff';
      ctx.fillRect(this.paddleMargin, this.leftY, this.paddleW, this.paddleH);

      ctx.fillStyle = '#e57bff';
      ctx.fillRect(W - this.paddleMargin - this.paddleW, this.rightY, this.paddleW, this.paddleH);

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.ball.x, this.ball.y, this.ball.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ZFG.games.Pong = Pong;
})();
