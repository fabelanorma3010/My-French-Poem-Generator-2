function generatePoem(event) {
  event.preventDefault();
  alert("generating poem");
}
let poemElement = document.querySelector("#poem");
poemElement.innerHTML = "la tombe dit a la rose";

let poemFormElement = document.querySelector("#poem-generator-form");
poemFormElement.addEventListener("submit", generatePoem);
