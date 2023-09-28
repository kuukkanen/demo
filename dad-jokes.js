(function () {
  const div = document.createElement("div");
  div.style.width = "450px";
  div.style.padding = "50px 20px";
  div.style.backgroundColor = "#FF0FF4";

  const button = document.createElement("button");
  button.textContent = "New Joke";

  const h1 = document.createElement("h1");
  h1.innerHTML = "Dad Jokes";

  const jokeText = document.createElement("p");
  jokeText.innerHTML =
    "What do you call a magician who has lost their magic? Ian.";

  content.appendChild(div);
  div.appendChild(h1);
  div.appendChild(jokeText);
  div.appendChild(button);

  getJoke();

  // getJoke() function definition
  function getJoke() {
    // make an API request to https://icanhazdadjoke.com/'
    fetch("https://icanhazdadjoke.com/", {
      headers: {
        Accept: "application/json",
      },
    })
      .then(function (response) {
        /* convert Stringified JSON response to Javascript Object */
        return response.json();
      })
      .then(function (data) {
        /* replace innerText of .joke-text with data.joke */
        // extract the joke text
        const joke = data.joke;
        // do the replacement
        jokeText.innerText = joke;
      });
  }
})();
