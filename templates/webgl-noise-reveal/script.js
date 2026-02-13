/*
 * WebGL Noise Image Reveal
 * Original Author: ashthornton (https://codepen.io/ashthornton)
 * Source: https://codepen.io/ashthornton/pen/BaBjxyX
 * License: MIT (CodePen default)
 */

class Ting {
  constructor() {
    this.canvas = document.getElementById("canvas");

    this.setup = this.setup.bind(this);
    this.render = this.render.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);

    this.setup();
    this.addEvents();
  }

  addEvents() {
    window.addEventListener("mousemove", this.onMouseMove);
  }

  setup() {
    this.mousePerspective = {
      _x: 0,
      _y: 0,
      x: 0,
      y: 0,
      origin: {
        x: 0,
        y: 0
      },
      updatePosition: function(e) {
        var e = event || window.event;
        this.x = e.clientX - this.origin.x;
        this.y = (e.clientY - this.origin.y) * -1;
      },
      setOrigin: function(e) {
        this.origin.x = e.offsetLeft + Math.floor(e.offsetWidth / 2);
        this.origin.y = e.offsetTop + Math.floor(e.offsetHeight / 2);
      }
    };

    this.mouseCanvas = { x: -500, y: -500, _x: -500, _y: -500 };

    this.gl = this.canvas.getContext("webgl", { premultipliedAlpha: false });
    this.rect = this.canvas.getBoundingClientRect();

    this.programInfo = twgl.createProgramInfo(this.gl, ["vs", "fs"]);
    this.bufferInfo = twgl.primitives.createXYQuadBufferInfo(this.gl);

    this.mousePerspective.setOrigin(this.canvas);

    this.imageSize = { width: 1, height: 1 };
    this.texture = twgl.createTextures(
      this.gl,
      {
        darkTexture: {
          src:
            "https://s3-us-west-2.amazonaws.com/s.cdpn.io/123024/photo-1464820453369-31d2c0b651af.jpg"
        }
      },
      (err, textures, sources) => {
        if (err) {
          console.error(err);
        }

        this.imageSize = sources.darkTexture;
        this.darkTexture = textures.darkTexture;

        this.render();
      }
    );
  }

  render(time) {
    twgl.resizeCanvasToDisplaySize(this.gl.canvas);

    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);

    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    this.gl.useProgram(this.programInfo.program);

    twgl.setBuffersAndAttributes(this.gl, this.programInfo, this.bufferInfo);

    const canvasAspect =
      this.gl.canvas.clientWidth / this.gl.canvas.clientHeight;
    const imageAspect = this.imageSize.width / this.imageSize.height;
    const mat = this.scaling(imageAspect / canvasAspect, -1);

    twgl.setUniforms(this.programInfo, {
      u_matrix: mat,
      u_darkImage: this.darkTexture,
      u_mouse: [this.mouseCanvas.x, this.mouseCanvas.y],
      u_time: time * 0.001
    });

    this.mouseCanvas.x = this.lerp(
      this.mouseCanvas.x,
      this.mouseCanvas._x,
      0.1
    );
    this.mouseCanvas.y = this.lerp(
      this.mouseCanvas.y,
      this.mouseCanvas._y,
      0.1
    );
    this.mousePerspective.x = this.lerp(
      this.mousePerspective.x,
      this.mousePerspective._x,
      0.1
    );
    this.mousePerspective.y = this.lerp(
      this.mousePerspective.y,
      this.mousePerspective._y,
      0.1
    );
    this.canvas.style.transform = `rotateX(${
      this.mousePerspective._x
    }deg) rotateY(${this.mousePerspective._y}deg)`;

    twgl.drawBufferInfo(this.gl, this.bufferInfo);

    requestAnimationFrame(this.render);
  }

  onMouseMove(e) {
    this.mousePerspective.updatePosition(e);
    this.mouseCanvas._x =
      (e.clientX - this.rect.left) * this.canvas.width / this.rect.width;
    this.mouseCanvas._y =
      this.canvas.height -
      (e.clientY - this.rect.top) * this.canvas.height / this.rect.height;
    this.mousePerspective._x = (
      this.mousePerspective.y /
      this.canvas.offsetHeight /
      2
    ).toFixed(2);
    this.mousePerspective._y = (
      this.mousePerspective.x /
      this.canvas.offsetWidth /
      2
    ).toFixed(2);
  }

  scaling(sx, sy) {
    return [sx, 0, 0, 0, sy, 0, 0, 0, 1];
  }

  lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
  }

  destroy() {}
}

new Ting();
