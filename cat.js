(function () {
  // Very rudimentary Wavefront .obj file format loader.
  // Doesn't support many features but good enough for our use case.
  // https://en.wikipedia.org/wiki/Wavefront_.obj_file
  const loadObj = (content) => {
    const positions = [];
    const normals = [];
    const textcoords = [];
    const vertices = [];

    // Loop through every line.
    content
      .trim()
      .split("\n")
      .forEach((line) => {
        const parts = line.split(" ");
        switch (parts[0]) {
          case "v":
            // Position value. Map to number values from string values.
            positions.push(parts.slice(1, 4).map((v) => Number(v)));
            break;

          case "vn":
            // Normal coordinate value. Map to number values from string values.
            normals.push(parts.slice(1, 4).map((v) => Number(v)));
            break;

          case "vt":
            // Texture coordinate value. Map to number values from string values.
            textcoords.push(parts.slice(1, 3).map((v) => Number(v)));
            break;

          case "f":
            // Triangle vertex value.
            parts.slice(1, 4).map((v) => {
              // Separate the values.
              const parts = v.split("/").map((v) => Number(v));

              // Create a new vertex. With the given position, normal, and texture coordinate values.
              vertices.push(
                ...positions[parts[0] - 1],
                ...textcoords[parts[1] - 1],
                ...normals[parts[2] - 1],
              );
            });
            break;

          default:
            console.error(`Unsupported syntax "${line}"`);
            break;
        }
      });

    return vertices;
  };

  const vertexShaderSrc = `#version 300 es

layout(location = 0) in vec3 pos;
layout(location = 1) in vec2 tex;
layout(location = 2) in vec3 norm;

uniform mat4 projection;
uniform mat4 view;

out vec2 v_tex;
out vec3 v_norm;

void main() {
  v_tex = tex;
  v_norm = normalize(norm);
  gl_Position = projection * view * vec4(pos, 1.0);
}
`;

  const fragmentShaderSrc = `#version 300 es
precision highp float;

in vec2 v_tex;
in vec3 v_norm;

uniform sampler2D tex;

out vec4 color;

void main() {
  vec3 ambient = vec3(0.1, 0.1, 0.2);
  float light = dot(v_norm, vec3(1.0));
  vec3 diffuse = vec3(1.0, 1.0, 0.9) * light;

  color.rgb = texture(tex, v_tex).rgb;
  color.a = 1.0;

  //color = vec4(ambient + diffuse, 1.0);
}
`;

  // Create canvas for WebGL.
  const canvas = document.createElement("canvas");

  // Reasonable size.
  canvas.width = 640;
  canvas.height = 480;

  const gl = canvas.getContext("webgl2");

  content.appendChild(canvas); // eslint-disable-line

  // Create the shader program.
  const createProgram = () => {
    // Create and compile vertex shader.
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSrc);
    gl.compileShader(vertexShader);

    // Create and compile fragment shader.
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSrc);
    gl.compileShader(fragmentShader);

    // Create and link the program.
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    // Shaders are no longer needed.
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    return program;
  };

  const program = createProgram();

  gl.useProgram(program); // Enable the shader program.

  gl.enable(gl.CULL_FACE); // Cull faces so they don't appear from the wrong side.
  gl.enable(gl.DEPTH_TEST); // Depth testing so vertices don't shine through each other.

  // No-op draw function at first and after object is loaded we implement this fully.
  let drawObj = () => {};

  // The main draw function.
  const draw = () => {
    // Resize viewport.
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Clear canvas.
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    drawObj();
  };

  fetch("cat.obj")
    .then((res) => res.text())
    .then((content) => {
      const obj = loadObj(content);

      // Use the first texture as the texture in the shader.
      gl.uniform1i(gl.getUniformLocation(program, "tex"), 0);

      // Create texture.
      const texture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);

      // Use white texture by default.
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGB,
        1,
        1,
        0,
        gl.RGB,
        gl.UNSIGNED_BYTE,
        new Uint8Array([255, 255, 255]), // White pixel.
      );

      // Load the texture image.
      const image = new Image();
      image.onload = () => {
        // Set the loaded date to the texture.
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGB,
          gl.RGB,
          gl.UNSIGNED_BYTE,
          image,
        );
        gl.generateMipmap(gl.TEXTURE_2D); // And generate mipmaps.

        draw();
      };
      image.src = "cat.jpg";

      // Buffer with the vertex data.
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(obj), gl.STATIC_DRAW);

      // First location is the position values.
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 8 * 4, 0);

      // Second location is the texture coordinate values.
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 8 * 4, 3 * 4);

      // Third location is the normal values.
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 8 * 4, 5 * 4);

      const projectionLoc = gl.getUniformLocation(program, "projection");
      const viewLoc = gl.getUniformLocation(program, "view");

      const perspective = (fov, aspect, near, far) => {
        const f = Math.tan(Math.PI * 0.5 - 0.5 * fov);
        const inv = 1.0 / (near - far);
        return [
          f / aspect,
          0,
          0,
          0,
          0,
          f,
          0,
          0,
          0,
          0,
          (near + far) * inv,
          -1,
          0,
          0,
          near * far * inv * 2,
          0,
        ];
      };

      gl.uniformMatrix4fv(projectionLoc, false, perspective(2, 1, 0.1, 10));
      gl.uniformMatrix4fv(
        viewLoc,
        false,
        [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -0.2, -0.2, 1],
      );

      const triangles = obj.length / 3;

      drawObj = () => {
        gl.drawArrays(gl.TRIANGLES, 0, triangles);
      };

      draw();
    });
})();
