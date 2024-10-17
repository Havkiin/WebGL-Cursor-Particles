// ref : https://webgl2fundamentals.org/webgl/lessons/webgl-2d-matrices.html

"use strict";

var vertexShaderSource = `#version 300 es

// an attribute is an input (in) to a vertex shader.
// It will receive data from a buffer
in vec2 a_position;

// Translation, rotation, scale
uniform mat3 u_matrix;

void main() {
  // Multiply the position by the matrix.
  gl_Position = vec4((u_matrix * vec3(a_position, 1)).xy, 0, 1);
}
`;

var fragmentShaderSource = `#version 300 es
precision highp float;

uniform vec4 u_color;

out vec4 outColor;

void main() {
  outColor = u_color;
}
`;

function main() {
  // Get A WebGL context
  const canvas = document.querySelector("#glcanvas");
  const gl = canvas.getContext("webgl2");
  if (!gl) {
    return;
  }

  // Use our boilerplate utils to compile the shaders and link into a program
  const program = webglUtils.createProgramFromSources(gl, [vertexShaderSource, fragmentShaderSource]);

  // look up uniform locations
  const positionAttributeLocation = gl.getAttribLocation(program, "a_position");

  const resolutionUniformLocation = gl.getUniformLocation(program, "u_resolution");
  const colorUniformLocation = gl.getUniformLocation(program, "u_color");
  const matrixUniformLocation = gl.getUniformLocation(program, "u_matrix");

  // Create a buffer
  const positionBuffer = gl.createBuffer();

  // Bind it to ARRAY_BUFFER
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // Create a vertex array object (attribute state)
  const vao = gl.createVertexArray();

  // and make it the one we're currently working with
  gl.bindVertexArray(vao);

  // Turn on the attribute
  gl.enableVertexAttribArray(positionAttributeLocation);

  // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
  const size = 2;          // 2 components per iteration
  const type = gl.FLOAT;   // the data is 32bit floats
  const normalize = false; // don't normalize the data
  const stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
  const offset = 0;        // start at the beginning of the buffer
  gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset);
  
  webglUtils.resizeCanvasToDisplaySize(gl.canvas);

  // Handle mouse move
  let mouseX = 0, mouseY = 0;
  canvas.addEventListener('mousemove', function(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });

  // Handle mouse click
  let radius = 50, wantedRadius, lerpStart;
  canvas.addEventListener('mousedown', (event) => {
    // Left click
    if (event.button == 0) {
      radius = 50;
      wantedRadius = 200;
      lerpStart = performance.now();
    }
  });
  canvas.addEventListener('mouseup', (event) => {
    // Left click
    if (event.button == 0) {
      radius = 200;
      wantedRadius = 50;
      lerpStart = performance.now();
    }
  });

  // Handle key press
  let colorMode = false;
  document.addEventListener('keydown', (event) => {
    if (event.key == 'c') {
      colorMode = !colorMode;
    }
  });

  const squaresData = []
  const numberOfSquares = 100;
  const maxOffset = 0.5;

  // Init squares
  for (let i = 0; i < numberOfSquares; i++) {
    const posX = gl.canvas.width * Math.random() * maxOffset;
    const posY = gl.canvas.height * Math.random() * maxOffset;
    
    squaresData[i] = [
      posX,
      posY,
      0,
      1,
      1
    ];
  }

  function drawScene() {
    webglUtils.resizeCanvasToDisplaySize(gl.canvas);
  
    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  
    // Clear the canvas
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  
    // Tell it to use our program (pair of shaders)
    gl.useProgram(program);
  
    // Bind the attribute/buffer set we want. 
    gl.bindVertexArray(vao);
  
    // Pass in the canvas resolution so we can convert from pixels to clipspace in the shader
    gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);

    const newRadius = lerp(radius, wantedRadius, (performance.now() - lerpStart) * 0.005);
    const spherePoints = generatePointsInSphere({ x: mouseX, y: mouseY, z: 0 }, newRadius, numberOfSquares);

    const squareWidth = 5;
    const squareHeight = 5;
    for (let i = 0; i < numberOfSquares; i++) {
      const [x, y, rotationInRadians, scaleX, scaleY] = squaresData[i];

      const translation = [x, y];
  
      // Update position
      squaresData[i][0] = spherePoints[i].x * 0.5;
      squaresData[i][1] = spherePoints[i].y * 0.5;
  
      // Set the vertices for the square
      var triangles = [
        [{ x: x, y: y }, { x: x + squareWidth, y: y }, { x: x, y: y + squareHeight }],
        [{ x: x + squareWidth, y: y }, { x: x + squareWidth, y: y + squareHeight }, { x: x, y: y + squareHeight }]
      ];
  
      // Update the buffer with the triangles for this square
      setTriangles(gl, triangles);
  
      // Compute the transformation matrix
      const projectionMatrix = m3.projection(gl.canvas.clientWidth, gl.canvas.clientHeight);
      const translationMatrix = m3.translation(translation[0], translation[1]);
      const rotationMatrix = m3.rotation(rotationInRadians);
      const scaleMatrix = m3.scaling(scaleX, scaleY);
  
      // Multiply the matrices in order: projection -> translation -> rotation -> scale
      let matrix = m3.multiply(projectionMatrix, translationMatrix);
      matrix = m3.multiply(matrix, rotationMatrix);
      matrix = m3.multiply(matrix, scaleMatrix);
  
      // Set the matrix for the shader
      gl.uniformMatrix3fv(matrixUniformLocation, false, matrix);
  
      // Set the color
      const color = (colorMode) ? [Math.random(), Math.random(), Math.random(), 1] : [1, 1, 1, 1];
      gl.uniform4fv(colorUniformLocation, color);
  
      // Draw the square (two triangles per square, so 6 vertices)
      const primitiveType = gl.TRIANGLES;
      const offset = 0;
      const count = 6;
      gl.drawArrays(primitiveType, offset, count);
    };

    requestAnimationFrame(drawScene);
  }

  function setTriangles(gl, triangles) {
    let vertices = [];

    // Loop over each triangle (expecting 3 vertices per triangle)
    triangles.forEach(triangle => {
        vertices.push(
            triangle[0].x, triangle[0].y,  // First vertex
            triangle[1].x, triangle[1].y,  // Second vertex
            triangle[2].x, triangle[2].y   // Third vertex
        );
    });

    // Upload the vertices to the buffer
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  }

  drawScene();
}

function clamp(x, min, max) {
  return Math.min(Math.max(x, min), max);
}

function lerp(a, b, alpha) {
  alpha = clamp(alpha, 0, 1);

  return a + alpha * ( b - a );
 }

function generatePointsInSphere(center, radius, numPoints) {
  const points = [];

  for (let i = 0; i < numPoints; i++) {
    let point;
    do {
      // Generate a random point inside a cube centered at the origin with side 2*radius
      const x = (Math.random() * 2 - 1) * radius;
      const y = (Math.random() * 2 - 1) * radius;
      const z = (Math.random() * 2 - 1) * radius;

      // Translate the point to the sphere's center
      point = {
        x: center.x + x,
        y: center.y + y,
        z: center.z + z
      };

      // Check if the point lies within the sphere
    } while ((point.x - center.x) ** 2 + (point.y - center.y) ** 2 + (point.z - center.z) ** 2 > radius ** 2);

    points.push(point);
  }

  return points;
}

var m3 = {
  projection: function (width, height) {
    // Note: This matrix flips the Y axis so that 0 is at the top.
    return [
      2 / width, 0, 0,
      0, -2 / height, 0,
      -1, 1, 1,
    ];
  },

  translation: function(tx, ty) {
    return [
      1, 0, 0,
      0, 1, 0,
      tx, ty, 1,
    ];
  },
 
  rotation: function(angleInRadians) {
    var c = Math.cos(angleInRadians);
    var s = Math.sin(angleInRadians);
    return [
      c,-s, 0,
      s, c, 0,
      0, 0, 1,
    ];
  },
 
  scaling: function(sx, sy) {
    return [
      sx, 0, 0,
      0, sy, 0,
      0, 0, 1,
    ];
  },

  multiply: function multiply(a, b) {
    var a00 = a[0 * 3 + 0];
    var a01 = a[0 * 3 + 1];
    var a02 = a[0 * 3 + 2];
    var a10 = a[1 * 3 + 0];
    var a11 = a[1 * 3 + 1];
    var a12 = a[1 * 3 + 2];
    var a20 = a[2 * 3 + 0];
    var a21 = a[2 * 3 + 1];
    var a22 = a[2 * 3 + 2];
    var b00 = b[0 * 3 + 0];
    var b01 = b[0 * 3 + 1];
    var b02 = b[0 * 3 + 2];
    var b10 = b[1 * 3 + 0];
    var b11 = b[1 * 3 + 1];
    var b12 = b[1 * 3 + 2];
    var b20 = b[2 * 3 + 0];
    var b21 = b[2 * 3 + 1];
    var b22 = b[2 * 3 + 2];
    return [
      b00 * a00 + b01 * a10 + b02 * a20,
      b00 * a01 + b01 * a11 + b02 * a21,
      b00 * a02 + b01 * a12 + b02 * a22,
      b10 * a00 + b11 * a10 + b12 * a20,
      b10 * a01 + b11 * a11 + b12 * a21,
      b10 * a02 + b11 * a12 + b12 * a22,
      b20 * a00 + b21 * a10 + b22 * a20,
      b20 * a01 + b21 * a11 + b22 * a21,
      b20 * a02 + b21 * a12 + b22 * a22,
    ];
  },
};

main();
