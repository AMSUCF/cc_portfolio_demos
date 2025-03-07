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
let iframeCreated = false; // Flag to track if iframe has been created

// Variables for Tracery functionality
let traceryGrammar;
let sightingJSON;
let traceryElementsCreated = false; // Flag to track if tracery elements have been created
let traceryUpdateInterval = 3000; // 3 seconds between updates
let traceryIntervalId = null; // Store interval ID for clearing later

// Variables for the tracery background particles
let traceryParticles = [];

// preload all three ml5 models
function preload() {
  sentiment = ml5.sentiment("MovieReviews");
  faceMesh = ml5.faceMesh(options);
  handPose = ml5.handPose();
  
  // Load Tracery JSON data
  sightingJSON = loadJSON('text/sighting.json');
}

function setup() {
  createCanvas(windowWidth-15, windowHeight-15);
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
    cleanupTraceryElements();
  } else if (state === "ml5") {
    drawMl5();
    if (iframeCreated) {
      select('#interactive-iframe').remove();
      iframeCreated = false;
    }
    cleanupTraceryElements();
  } else if (state === "interactive") {
    drawInteractiveFiction();
    cleanupTraceryElements();
  } else if (state === "tracery") {
    drawTracery();
    if (iframeCreated) {
      select('#interactive-iframe').remove();
      iframeCreated = false;
    }
  } else if (state === "credits") {
    drawCredits();
    if (iframeCreated) {
      select('#interactive-iframe').remove();
      iframeCreated = false;
    }
    cleanupTraceryElements();
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
  
  // Only create the iframe if it doesn't exist yet
  if (!iframeCreated) {
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
    iframeCreated = true;
  }
}

function drawTracery() {
  // Black canvas background for consistency with fading
  background(0, 0, 0, 50); // Using semi-transparent background for particle trail effect
  
  // Update and display tracery background particles
  for (let i = traceryParticles.length - 1; i >= 0; i--) {
    traceryParticles[i].update();
    traceryParticles[i].show();
    if (traceryParticles[i].finished()) {
      traceryParticles.splice(i, 1);
    }
  }
  
  // Only create the tracery elements if they don't exist yet
  if (!traceryElementsCreated) {
    createTraceryElements();
    traceryElementsCreated = true;
    
    // Initialize grammar
    if (sightingJSON) {
      traceryGrammar = tracery.createGrammar(sightingJSON);
      updateTraceryContent(); // Initial content update
      
      // Set interval to update content every 3 seconds
      traceryIntervalId = setInterval(updateTraceryContent, traceryUpdateInterval);
    }
  }
}

function createTraceryElements() {
  // Get nav button height to position elements properly
  let navButtons = getNavButtons();
  let topOffset = navButtons[0].h + 60; // height of nav buttons + vertical position + spacing
  
  // Create title element
  let titleElement = createElement('h1', 'Alien Sightings Generator');
  titleElement.id('tracery-title');
  titleElement.position(0, topOffset);
  titleElement.style('width', '100%');
  titleElement.style('text-align', 'center');
  titleElement.style('color', '#39ff14'); // Neon green
  titleElement.style('text-shadow', '0 0 10px #39ff14, 0 0 20px #39ff14');
  
  // Create illustration container
  let illustrationElement = createElement('div');
  illustrationElement.id('tracery-illustration');
  illustrationElement.position(0, topOffset + 70);
  illustrationElement.style('width', '100%');
  illustrationElement.style('text-align', 'center');
  
  // Create sightings text element
  let sightingsElement = createElement('p');
  sightingsElement.id('tracery-sightings');
  sightingsElement.position(width/2 - 300, topOffset + 300);
  sightingsElement.style('width', '600px');
  sightingsElement.style('min-height', '100px');
  sightingsElement.style('margin', '0 auto');
  sightingsElement.style('padding', '20px');
  sightingsElement.style('background-color', 'rgba(0, 255, 0, 0.1)');
  sightingsElement.style('border', '2px solid #39ff14');
  sightingsElement.style('box-shadow', '0 0 20px #39ff14');
  sightingsElement.style('font-size', '1.2em');
  sightingsElement.style('color', 'white');
  sightingsElement.style('text-align', 'center');
}

function updateTraceryContent() {
  if (traceryGrammar) {
    // Generate new content
    let sightingReport = traceryGrammar.flatten("#origin#");
    let sightingImage = traceryGrammar.flatten("#image#");
    let sightingTitle = traceryGrammar.flatten("#title#");
    
    // Update DOM elements
    select('#tracery-title').html(sightingTitle);
    select('#tracery-sightings').html(sightingReport);
    select('#tracery-illustration').html(sightingImage);
  }
}

function cleanupTraceryElements() {
  // If we're not in tracery mode but elements exist, remove them
  if (traceryElementsCreated) {
    // Clear the update interval
    if (traceryIntervalId) {
      clearInterval(traceryIntervalId);
      traceryIntervalId = null;
    }
    
    // Remove DOM elements
    select('#tracery-title').remove();
    select('#tracery-illustration').remove();
    select('#tracery-sightings').remove();
    
    traceryElementsCreated = false;
  }
  
  // Clear the tracery particles when leaving tracery mode
  traceryParticles = [];
}

function drawCredits() {
  background(0); // Change to black background
  textAlign(CENTER, CENTER);
  textSize(24);
  fill(255); // Change to white text
  text("Inform 7 code written with generative assists from Gemini and ChatGPT 4.0.\n\nIridium template modified using CoPilot Agent and GPT 4.0.\n\nTracery generator code assisted with text nodes scraped from science fiction\nusing Python code written by ChatGPT o3.\n\nSVG generated with ChatGPT 4.0.\n\nml5 code based on remixing examples provided by the ml5 team.\n\nSome remixing done with Claude 3.7 Sonnet.", width / 2, height / 2);
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
  
  // Reposition tracery elements if they exist
  if (traceryElementsCreated) {
    let navButtons = getNavButtons();
    let topOffset = navButtons[0].h + 60;
    
    select('#tracery-title').position(0, topOffset);
    select('#tracery-illustration').position(0, topOffset + 70);
    select('#tracery-sightings').position(width/2 - 300, topOffset + 300);
  }
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
  let clickedButton = false;
  
  // Check if a nav button was clicked
  for (let btn of navButtons) {
    if (
      mouseX > btn.x - btn.w / 2 &&
      mouseX < btn.x + btn.w / 2 &&
      mouseY > btn.y - btn.h / 2 &&
      mouseY < btn.y + btn.h / 2
    ) {
      clickedButton = true;
      
      // If we're leaving interactive fiction state and an iframe exists, remove it
      if (state === "interactive" && iframeCreated && btn.state !== "interactive") {
        select('#interactive-iframe').remove();
        iframeCreated = false;
      }
      
      // If we're leaving tracery state, clean up the elements
      if (state === "tracery" && btn.state !== "tracery") {
        cleanupTraceryElements();
      }
      
      state = btn.state;
      if (state === "ml5") {
        inputBox.elt.focus();
      }
      return;
    }
  }
  
  // If we're in tracery mode and didn't click a button, add a particle
  if (state === "tracery" && !clickedButton && traceryGrammar) {
    let output = traceryGrammar.flatten("#title#");
    let p = new TraceryParticle(mouseX, mouseY, output);
    traceryParticles.push(p);
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

// ------------- Tracery Background Particle Class -------------

class TraceryParticle {
  constructor(x, y, text) {
    this.x = x;
    this.y = y;
    this.vx = random(-1, 1);
    this.vy = random(-1, 1);
    this.size = random(15, 20);
    this.text = text;
  }
  
  finished() {
    return (this.x < 0 || this.x > windowWidth || this.y < 0 || this.y > windowHeight);
  }
  
  update() {
    this.x += this.vx;
    this.y += this.vy;
  }
  
  show() {
    noStroke();
    textSize(this.size);
    textFont("Courier");
    textAlign(CENTER, CENTER);
    fill(57, 255, 20); // Neon green
    text(this.text, this.x, this.y);
  }
}
