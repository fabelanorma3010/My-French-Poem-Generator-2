const poemFormElement = document.querySelector("#poem-generator-form");
const instructionsInput = document.querySelector("#user-instructions");
const letterSceneElement = document.querySelector("#letter-scene");
const poemElement = document.querySelector("#poem");
const savePoemButton = document.querySelector("#save-poem-button");
const saveStatusElement = document.querySelector("#save-status");
const savedPoemsSection = document.querySelector("#saved-poems");
const savedPoemList = document.querySelector("#saved-poem-list");
const submitButton = poemFormElement.querySelector('input[type="submit"]');
const sirenElement = document.querySelector(".siren-light");
const sirenToggleButton = document.querySelector("#siren-toggle");
const ambientToggleButton = document.querySelector("#ambient-toggle");
const ambientVolumeInput = document.querySelector("#ambient-volume");
const ambientStatusElement = document.querySelector("#ambient-status");
const themeToggleButton = document.querySelector("#theme-toggle");
let sirenAudioContext;
let sirenOscillator;
let sirenModulator;
let sirenGain;
let ambientAudioContext;
let ambientGainNode;
let ambientOscillators = [];
let ambientChordTimer;
let ambientChordIndex = 1;
let ambientIsPlaying = false;
let poemTypewriter;
let currentPoemTopic = "";
let currentPoemText = "";
const savedPoemsStorageKey = "saved-poems";

function setLightTheme(isLight) {
  document.body.classList.toggle("light-theme", isLight);
  themeToggleButton.setAttribute("aria-pressed", String(isLight));
  themeToggleButton.textContent = `Light mode: ${isLight ? "On" : "Off"}`;
  localStorage.setItem("light-theme", String(isLight));
}

setLightTheme(localStorage.getItem("light-theme") === "true");

function getSavedPoems() {
  try {
    const savedPoems = JSON.parse(
      localStorage.getItem(savedPoemsStorageKey) || "[]",
    );
    return Array.isArray(savedPoems)
      ? savedPoems.filter(
          (poem) =>
            typeof poem.id === "string" &&
            typeof poem.topic === "string" &&
            typeof poem.text === "string" &&
            typeof poem.savedAt === "string",
        )
      : [];
  } catch {
    return [];
  }
}

function renderSavedPoems() {
  savedPoemList.replaceChildren();
  const savedPoems = getSavedPoems();
  savedPoemsSection.classList.toggle("hidden", savedPoems.length === 0);

  for (const savedPoem of savedPoems) {
    const item = document.createElement("li");
    item.className = "saved-poem-item";

    const details = document.createElement("details");
    const summary = document.createElement("summary");
    const topic = document.createElement("span");
    topic.textContent = savedPoem.topic;
    const savedAt = document.createElement("time");
    savedAt.dateTime = savedPoem.savedAt;
    savedAt.textContent = new Date(savedPoem.savedAt).toLocaleDateString();
    summary.append(topic, savedAt);

    const text = document.createElement("p");
    text.className = "saved-poem-text";
    text.textContent = savedPoem.text;

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-saved-poem";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => {
      const updatedPoems = getSavedPoems().filter(
        (poem) => poem.id !== savedPoem.id,
      );
      localStorage.setItem(savedPoemsStorageKey, JSON.stringify(updatedPoems));
      renderSavedPoems();
    });

    details.append(summary, text, deleteButton);
    item.append(details);
    savedPoemList.append(item);
  }
}

renderSavedPoems();

function extractPoemText(markup) {
  const parsedPoem = new DOMParser().parseFromString(markup, "text/html");
  const textParts = [];

  function collectText(node) {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        textParts.push(child.textContent);
      } else if (child.nodeName === "BR") {
        textParts.push("\n");
      } else {
        collectText(child);
      }
    }
  }

  collectText(parsedPoem.body);
  return textParts.join("").trim();
}

function removeSheCodesSignature(markup) {
  const parsedPoem = new DOMParser().parseFromString(markup, "text/html");
  const lastNode = Array.from(parsedPoem.body.childNodes)
    .reverse()
    .find(
      (node) => node.nodeType !== Node.TEXT_NODE || node.textContent.trim(),
    );

  if (
    lastNode?.nodeName !== "STRONG" ||
    lastNode.textContent.trim().toLowerCase() !== "shecodes ai"
  ) {
    return markup;
  }

  const precedingBreak = lastNode.previousSibling;
  lastNode.remove();
  if (precedingBreak?.nodeName === "BR") precedingBreak.remove();
  return parsedPoem.body.innerHTML.trim();
}

function stopPoemTyping() {
  poemTypewriter?.stop();
  poemTypewriter = null;
}

function startSirenSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  sirenAudioContext ??= new AudioContext();
  void sirenAudioContext.resume().catch(() => {});
  if (sirenOscillator) return;

  sirenOscillator = sirenAudioContext.createOscillator();
  sirenModulator = sirenAudioContext.createOscillator();
  const modulationDepth = sirenAudioContext.createGain();
  sirenGain = sirenAudioContext.createGain();

  sirenOscillator.type = "sine";
  sirenOscillator.frequency.value = 760;
  sirenModulator.frequency.value = 0.7;
  modulationDepth.gain.value = 340;
  sirenGain.gain.value = 0.035;

  sirenModulator.connect(modulationDepth);
  modulationDepth.connect(sirenOscillator.frequency);
  sirenOscillator.connect(sirenGain);
  sirenGain.connect(sirenAudioContext.destination);

  sirenOscillator.start();
  sirenModulator.start();
}

function stopSirenSound() {
  if (!sirenAudioContext || !sirenOscillator || !sirenModulator || !sirenGain) {
    return;
  }

  const stopAt = sirenAudioContext.currentTime + 0.12;
  sirenGain.gain.setTargetAtTime(0, sirenAudioContext.currentTime, 0.03);
  sirenOscillator.stop(stopAt);
  sirenModulator.stop(stopAt);
  sirenOscillator = null;
  sirenModulator = null;
  sirenGain = null;
}

const ambientChordProgression = [
  [130.81, 164.81, 196, 261.63],
  [110, 130.81, 164.81, 220],
  [98, 123.47, 146.83, 196],
  [116.54, 146.83, 174.61, 233.08],
];

function playNextAmbientChord() {
  if (!ambientIsPlaying || !ambientAudioContext) return;

  const chord = ambientChordProgression[ambientChordIndex];
  const now = ambientAudioContext.currentTime;
  ambientOscillators.forEach((oscillator, index) => {
    oscillator.frequency.setTargetAtTime(chord[index], now, 2.5);
  });
  ambientChordIndex = (ambientChordIndex + 1) % ambientChordProgression.length;
  ambientChordTimer = window.setTimeout(playNextAmbientChord, 9000);
}

function startAmbientMusic() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    ambientStatusElement.textContent = "Audio is not supported in this browser";
    return false;
  }

  ambientAudioContext ??= new AudioContext();
  void ambientAudioContext.resume().catch(() => {});
  ambientGainNode = ambientAudioContext.createGain();
  ambientGainNode.gain.setValueAtTime(0, ambientAudioContext.currentTime);
  ambientGainNode.gain.setTargetAtTime(
    Number(ambientVolumeInput.value) * 0.16,
    ambientAudioContext.currentTime,
    1.2,
  );
  ambientGainNode.connect(ambientAudioContext.destination);

  ambientOscillators = ambientChordProgression[0].map((frequency, index) => {
    const oscillator = ambientAudioContext.createOscillator();
    const noteGain = ambientAudioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    noteGain.gain.value = index === 3 ? 0.3 : 0.42;
    oscillator.connect(noteGain);
    noteGain.connect(ambientGainNode);
    oscillator.start();
    return oscillator;
  });

  ambientIsPlaying = true;
  ambientChordIndex = 1;
  ambientChordTimer = window.setTimeout(playNextAmbientChord, 9000);
  ambientToggleButton.setAttribute("aria-pressed", "true");
  ambientToggleButton.textContent = "Pause music";
  ambientStatusElement.textContent = "Playing softly";
  return true;
}

function stopAmbientMusic() {
  if (!ambientIsPlaying || !ambientAudioContext || !ambientGainNode) return;

  ambientIsPlaying = false;
  window.clearTimeout(ambientChordTimer);
  const now = ambientAudioContext.currentTime;
  const stopAt = now + 0.5;
  ambientGainNode.gain.cancelScheduledValues(now);
  ambientGainNode.gain.setTargetAtTime(0, now, 0.12);
  ambientOscillators.forEach((oscillator) => oscillator.stop(stopAt));
  ambientOscillators = [];
  ambientGainNode = null;
  ambientToggleButton.setAttribute("aria-pressed", "false");
  ambientToggleButton.textContent = "Play music";
  ambientStatusElement.textContent = "Paused";
}

function setAmbientVolume() {
  if (!ambientAudioContext || !ambientGainNode) return;

  ambientGainNode.gain.setTargetAtTime(
    Number(ambientVolumeInput.value) * 0.16,
    ambientAudioContext.currentTime,
    0.15,
  );
}

const apiKey = "2046c535afeb092fo82f1d306d8a2b2t";
const context =
  "You are a romantic English poem expert. Write a short poem in English with four lines in basic HTML, separating each line with a <br />. Follow the user's instructions, do not include a title, and do not add an author attribution or signature.";

function displayPoem(answer, topic) {
  stopPoemTyping();
  letterSceneElement.classList.add("has-poem");
  currentPoemTopic = topic;
  currentPoemText = extractPoemText(answer);
  savePoemButton.disabled = false;
  savePoemButton.classList.remove("hidden");
  poemElement.replaceChildren();
  letterSceneElement.classList.remove("is-opening");
  void letterSceneElement.offsetWidth;
  letterSceneElement.classList.add("is-opening");

  const typewriter = new Typewriter("#poem", {
    delay: 1,
    loop: false,
    cursor: "",
  });
  poemTypewriter = typewriter;
  typewriter
    .typeString(answer)
    .callFunction(() => {
      if (poemTypewriter !== typewriter) return;
      poemElement.innerHTML = answer;
      poemTypewriter = null;
    })
    .start();
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

  stopPoemTyping();
  const params = new URLSearchParams({
    prompt: `Generate an English poem about ${topic}`,
    context,
    key: apiKey,
  });

  currentPoemTopic = "";
  currentPoemText = "";
  savePoemButton.disabled = true;
  savePoemButton.textContent = "Save poem";
  savePoemButton.classList.add("hidden");
  saveStatusElement.textContent = "";
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

    displayPoem(removeSheCodesSignature(data.answer), topic);
  } catch (error) {
    console.error("Could not generate poem:", error);
    poemElement.textContent =
      "The poem could not be generated. Check your internet connection and poem service configuration, then try again.";
  } finally {
    submitButton.disabled = false;
  }
}

poemFormElement.addEventListener("submit", generatePoem);

savePoemButton.addEventListener("click", () => {
  if (!currentPoemTopic || !currentPoemText) return;

  const savedPoem = {
    id: `${Date.now()}-${Math.random()}`,
    topic: currentPoemTopic,
    text: currentPoemText,
    savedAt: new Date().toISOString(),
  };

  try {
    const savedPoems = getSavedPoems();
    savedPoems.unshift(savedPoem);
    localStorage.setItem(
      savedPoemsStorageKey,
      JSON.stringify(savedPoems.slice(0, 30)),
    );
    renderSavedPoems();
    savePoemButton.disabled = true;
    savePoemButton.textContent = "Saved";
    saveStatusElement.textContent = "Saved to this browser";
  } catch {
    saveStatusElement.textContent = "Could not save this poem";
  }
});

sirenToggleButton.addEventListener("click", () => {
  const isOn = sirenToggleButton.getAttribute("aria-pressed") === "true";
  sirenElement.classList.toggle("is-off", isOn);
  sirenToggleButton.setAttribute("aria-pressed", String(!isOn));
  sirenToggleButton.textContent = `Siren: ${isOn ? "Off" : "On"}`;
  if (isOn) {
    stopSirenSound();
  } else {
    startSirenSound();
  }
});

ambientToggleButton.addEventListener("click", () => {
  if (ambientIsPlaying) {
    stopAmbientMusic();
  } else {
    startAmbientMusic();
  }
});

ambientVolumeInput.addEventListener("input", setAmbientVolume);

themeToggleButton.addEventListener("click", () => {
  const isLight = document.body.classList.contains("light-theme");
  setLightTheme(!isLight);
});
