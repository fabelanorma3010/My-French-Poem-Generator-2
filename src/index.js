const poemFormElement = document.querySelector("#poem-generator-form");
const instructionsInput = document.querySelector("#user-instructions");
const letterSceneElement = document.querySelector("#letter-scene");
const poemElement = document.querySelector("#poem");
const submitButton = poemFormElement.querySelector('input[type="submit"]');
const sirenElement = document.querySelector(".siren-light");
const sirenToggleButton = document.querySelector("#siren-toggle");

const apiKey = "2046c535afeb092fo82f1d306d8a2b2t";
const context =
  "You are a romantic English poem expert. Write a short poem in English with four lines in basic HTML, separating each line with a <br />. Follow the user's instructions, do not include a title, and sign the poem with 'SheCodes AI' inside a <strong> element at the end.";

function displayPoem(answer) {
  poemElement.replaceChildren();
  letterSceneElement.classList.remove("is-opening");
  void letterSceneElement.offsetWidth;
  letterSceneElement.classList.add("is-opening");

  new Typewriter("#poem", {
    strings: [answer],
    autoStart: true,
    delay: 1,
    cursor: "",
    onComplete: () => {
      poemElement.innerHTML = answer;
    },
  });
}

async function generatePoem(event) {
  event.preventDefault();

  const topic = instructionsInput.value.trim();
  if (!topic) {
    letterSceneElement.classList.remove("hidden");
    poemElement.textContent = "Please enter a topic for your poem.";
    instructionsInput.focus();
    return;
  }

  const params = new URLSearchParams({
    prompt: `Generate an English poem about ${topic}`,
    context,
    key: apiKey,
  });

  letterSceneElement.classList.remove("hidden", "is-opening");
  poemElement.textContent = `⏳ Generating an English poem about ${topic}…`;
  submitButton.disabled = true;

  try {
    const response = await fetch(
      `https://api.shecodes.io/ai/v1/generate?${params.toString()}`,
    );
    if (!response.ok) {
      throw new Error(`The poem service returned HTTP ${response.status}.`);
    }

    const data = await response.json();
    if (typeof data.answer !== "string" || !data.answer.trim()) {
      throw new Error("The poem service returned no answer.");
    }

    displayPoem(data.answer);
  } catch (error) {
    console.error("Could not generate poem:", error);
    poemElement.textContent =
      "The poem could not be generated. Check your internet connection and SheCodes API key, then try again.";
  } finally {
    submitButton.disabled = false;
  }
}

poemFormElement.addEventListener("submit", generatePoem);

sirenToggleButton.addEventListener("click", () => {
  const isOn = sirenToggleButton.getAttribute("aria-pressed") === "true";
  sirenElement.classList.toggle("is-off", isOn);
  sirenToggleButton.setAttribute("aria-pressed", String(!isOn));
  sirenToggleButton.textContent = `Siren: ${isOn ? "Off" : "On"}`;
});
