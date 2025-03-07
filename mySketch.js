// modified from the ml5.js sentiment analysis demo - https://editor.p5js.org/ml5/sketches/hopIvsCGL
// mixed with ml5.js facemesh lip tracking demo - https://editor.p5js.org/ml5/sketches/9y9W7eAee
// and now with integrated basic particle systems for handling textual elements
// adding a title screen with finger tracking modified from - https://editor.p5js.org/ml5/sketches/QGH3dwJ1A
// tracking letters cleared with the finger movements for game-like interface
// chatgpt o3-mini-high addition of navigation system

// variables for title stuff
let state = "title";
let titleLetters = [];
let numLetters = 100;
let clearedCount = 0;
let handPose;
let hands = [];

// variables for main typing analysis
let sentiment;
let inputBox;
let currentSentimentScore = 0.5; // start neutral
let currentText = ""; // holds only the most recent word being typed
let fullText = "";    // holds the accumulated text over time
let lastWord = "type something";
let faceMesh;
let video;
let faces = [];
let options = { maxFaces: 1, refineLandmarks: false, flipHorizontal: false };
let textX;
let textY;
let wordParticles = [];

// preload all three ml5 models
function preload() {
  sentiment = ml5.sentiment("MovieReviews");
  faceMesh = ml5.faceMesh(options);
  handPose = ml5.handPose();
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  textX = width / 2;
  textY = height / 2;
  
  // title screen falling letters
  for (let i = 0; i < numLetters; i++) {
    titleLetters.push(new LetterParticle(random(width), random(-height, 0)));
  }
  
  // video capture (used for both face and hands)
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();
  
  // start ml5 models 
  faceMesh.detectStart(video, gotFaces);
  handPose.detectStart(video, gotHands);
  
  // input and setup for sentiment analysis
  inputBox = createInput("");
  inputBox.style('opacity', '0');
  inputBox.input(onInput);
  inputBox.elt.focus();
  sentiment.predict(fullText, gotResult);
}

function draw() {
  // draw state-specific background/sketch
  if (state === "title") {
    drawTitleScreen();
  } else if (state === "ml5") {
    drawMl5();
    select('#interactive-iframe').remove();
  } else if (state === "interactive") {
    drawInteractiveFiction();
  } else if (state === "tracery") {
    drawTracery();
    select('#interactive-iframe').remove();
  } else if (state === "credits") {
    drawCredits();
    select('#interactive-iframe').remove();
  }
  
  // always draw navigation buttons at the top
  drawNavButtons();
}

// ------------- Navigation Buttons (Persistent at Top) -------------

function getNavButtons() {
  let btnData = [
    { label: "ml5", state: "ml5", w: 200, h: 50 },
    { label: "interactive fiction", state: "interactive", w: 300, h: 50 },
    { label: "tracery", state: "tracery", w: 200, h: 50 },
    { label: "credits", state: "credits", w: 200, h: 50 }
  ];
  let spacing = 20;
  let totalWidth = btnData.reduce((acc, btn) => acc + btn.w, 0) + spacing * (btnData.length - 1);
  let startX = (width - totalWidth) / 2;
  let y = 40; // fixed vertical position at top
  let navButtons = [];
  let currentX = startX;
  for (let btn of btnData) {
    let btnObj = { label: btn.label, state: btn.state, w: btn.w, h: btn.h, x: currentX + btn.w / 2, y: y };
    navButtons.push(btnObj);
    currentX += btn.w + spacing;
  }
  return navButtons;
}

function drawNavButtons() {
  let navButtons = getNavButtons();
  rectMode(CENTER);
  for (let btn of navButtons) {
    fill(0, 200, 0);
    noStroke();
    rect(btn.x, btn.y, btn.w, btn.h, 10);
    fill(255);
    textSize(20);
    textAlign(CENTER, CENTER);
    text(btn.label, btn.x, btn.y);
  }
}

// ------------- State-specific Drawing Functions -------------

function drawTitleScreen() {
  background(0);
  
  // falling letters with hand collision removal
  for (let i = titleLetters.length - 1; i >= 0; i--) {
    let letter = titleLetters[i];
    let removed = false;
    for (let h = 0; h < hands.length; h++) {
      let hand = hands[h];
      for (let j = 0; j < hand.keypoints.length; j++) {
        let kp = hand.keypoints[j];
        if (dist(letter.x, letter.y, kp.x, kp.y) < letter.size * 0.8) {
          titleLetters.splice(i, 1);
          clearedCount++;
          removed = true;
          break;
        }
      }
      if (removed) break;
    }
    if (!removed) {
      letter.update();
      letter.display();
    }
  }
  
  // display hand keypoints
  for (let h = 0; h < hands.length; h++) {
    let hand = hands[h];
    for (let j = 0; j < hand.keypoints.length; j++) {
      let kp = hand.keypoints[j];
      fill(0, 255, 0);
      noStroke();
      circle(kp.x, kp.y, 10);
    }
  }
  
  // title instructions (centered a bit lower to leave room for nav buttons)
  textAlign(CENTER, CENTER);
  textSize(48);
  textStyle(BOLD);
  fill(255);
  text("Wave to clear text - enjoy selecting an option", width / 2, height / 2);
  
  // cleared counter at top-right
  textAlign(RIGHT, TOP);
  textSize(24);
  fill(255);
  text("Cleared: " + clearedCount, width - 10, 10);
}

function drawMl5() {
  // ensure input box remains focused in ml5 mode
  inputBox.elt.focus();
  
  drawSentimentPattern();
  
  // display current or last word
  textAlign(CENTER, CENTER);
  textSize(96);
  textStyle(BOLD);
  fill(0);
  text(currentText === "" ? lastWord : currentText, textX, textY);
  
  // update and display word particles
  for (let i = wordParticles.length - 1; i >= 0; i--) {
    let p = wordParticles[i];
    p.update();
    p.display();
    if (p.isOffScreen()) {
      wordParticles.splice(i, 1);
    }
  }
  
  drawPartsKeypoints();
}

function drawInteractiveFiction() {
  background(200);
  let navButtons = getNavButtons();
  let navHeight = navButtons[0].h + 40; // height of nav buttons + vertical position
  let iframeY = navHeight + 20; // add some spacing
  let iframeHeight = height - iframeY;
  let iframe = createElement('iframe');
  iframe.attribute('src', 'if/index.html');
  iframe.attribute('width', '100%');
  iframe.attribute('height', iframeHeight);
  iframe.position(0, iframeY);
  iframe.id('interactive-iframe');
}

function drawTracery() {
  background(220);
  textAlign(CENTER, CENTER);
  textSize(48);
  fill(0);
  text("Tracery Placeholder", width / 2, height / 2);
}

function drawCredits() {
  background(255);
  textAlign(CENTER, CENTER);
  textSize(24);
  fill(0);
  text("Inform 7 code written with generative assists from Gemini and ChatGPT 4.0.\nIridium template modified using CoPilot Agent and GPT 4.0.\nTracery generator code assisted with text nodes scraped from science fiction using Python code written by ChatGPT o3.\nSVG generated with ChatGPT 4.0.\nml5 code based on remixing examples provided by the ml5 team.", width / 2, height / 2);
}

// ------------- Input, Sentiment, and Face/Hand Processing -------------

function onInput() {
  let inputVal = inputBox.value();
  if (inputVal.endsWith(" ")) {
    let word = inputVal.trim();
    if (word.length > 0) {
      lastWord = word;
      addNewWord(lastWord, textX, textY);
      fullText += (fullText.length > 0 ? " " : "") + word;
      sentiment.predict(fullText, gotResult);
    }
    inputBox.value("");
    currentText = "";
  } else {
    currentText = inputVal;
  }
}

function gotResult(result) {
  currentSentimentScore = result.confidence;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  video.size(width, height);
  video.hide();
}

function gotFaces(results) {
  faces = results;
}

function gotHands(results) {
  hands = results;
}

function drawPartsKeypoints() {
  if (faces.length > 0) {
    let totalX = 0;
    let totalY = 0;
    let lipPoints = faces[0].lips.keypoints;
    for (let i = 0; i < lipPoints.length; i++) {
      let lip = lipPoints[i];
      totalX += lip.x;
      totalY += lip.y;
      fill(255, 0, 0);
      circle(lip.x, lip.y, 5);
    }
    textX = totalX / lipPoints.length;
    textY = totalY / lipPoints.length;
  } else {
    textX = width / 2;
    textY = height / 2;
  }
}

class WordParticle {
  constructor(txt, x, y) {
    this.txt = txt;
    this.pos = createVector(x, y);
    this.vel = createVector(random(-0.5, 0.5), random(-2, -1));
    this.acc = createVector(0, -0.05);
  }
  
  update() {
    this.vel.add(this.acc);
    this.pos.add(this.vel);
  }
  
  display() {
    fill(0);
    noStroke();
    text(this.txt, this.pos.x, this.pos.y);
  }
  
  isOffScreen() {
    return (this.pos.y < 0);
  }
}

function addNewWord(lastword, textX, textY) {
  wordParticles.push(new WordParticle(lastword, textX, textY));
}

function drawSentimentPattern() {
  background(255, 255, 255, 10);
  noStroke();
  let numCircles = 10;
  for (let i = 0; i < numCircles; i++) {
    let x = random(width);
    let y = random(height);
    let d = random(10, 100);
    let baseR = lerp(255, 0, currentSentimentScore);
    let baseG = lerp(0, 255, currentSentimentScore);
    let rVal = constrain(baseR + random(-30, 30), 0, 255);
    let gVal = constrain(baseG + random(-30, 30), 0, 255);
    let bVal = random(0, 50);
    let aVal = random(50, 150);
    fill(rVal, gVal, bVal, aVal);
    circle(x, y, d);
  }
}

// ------------- Mouse Interaction (Nav Buttons Always Active) -------------

function mousePressed() {
  let navButtons = getNavButtons();
  for (let btn of navButtons) {
    if (
      mouseX > btn.x - btn.w / 2 &&
      mouseX < btn.x + btn.w / 2 &&
      mouseY > btn.y - btn.h / 2 &&
      mouseY < btn.y + btn.h / 2
    ) {
      state = btn.state;
      if (state === "ml5") {
        inputBox.elt.focus();
      }
      select('#interactive-iframe').remove();
      return;
    }
  }
  
  // For ml5 state, if click isn't on a nav button, ensure input remains focused
  if (state === "ml5") {
    inputBox.elt.focus();
  }
}

// ------------- Title Screen Letter Particle Class -------------

class LetterParticle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.speed = random(1, 3);
    this.letter = this.getRandomLetter();
    this.size = random(16, 32);
    this.shade = random(150, 255);
  }
  
  getRandomLetter() {
    let letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return letters.charAt(floor(random(letters.length)));
  }
  
  update() {
    this.y += this.speed;
    if (this.y > height) {
      this.y = -this.size;
      this.x = random(width);
      this.letter = this.getRandomLetter();
    }
  }
  
  display() {
    fill(this.shade);
    noStroke();
    textSize(this.size);
    text(this.letter, this.x, this.y);
  }
}
