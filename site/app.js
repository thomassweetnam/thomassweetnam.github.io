(function () {
  const breeds = Array.isArray(window.BREEDS) ? window.BREEDS.slice() : [];

  const elements = {
    breedCount: document.getElementById("breed-count"),
    totalPicks: document.getElementById("total-picks"),
    picksLeft: document.getElementById("picks-left"),
    roundLabel: document.getElementById("round-label"),
    progressFill: document.getElementById("progress-fill"),
    progressText: document.getElementById("progress-text"),
    byeNote: document.getElementById("bye-note"),
    errorMessage: document.getElementById("error-message"),
    matchupPanel: document.getElementById("matchup-panel"),
    championPanel: document.getElementById("champion-panel"),
    championImage: document.getElementById("champion-image"),
    championName: document.getElementById("champion-name"),
    championSummary: document.getElementById("champion-summary"),
    championLink: document.getElementById("champion-link"),
    historyList: document.getElementById("history-list"),
    newBracketButton: document.getElementById("new-bracket-button"),
    playAgainButton: document.getElementById("play-again-button"),
    cards: Array.from(document.querySelectorAll(".dog-card")),
  };

  const state = {
    allBreeds: breeds,
    roundEntrants: [],
    roundWinners: [],
    roundNumber: 1,
    matchIndex: 0,
    completedPicks: 0,
    totalPicks: Math.max(0, breeds.length - 1),
    champion: null,
    history: [],
  };

  function shuffleDogs(items) {
    const shuffled = items.slice();
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const current = shuffled[index];
      shuffled[index] = shuffled[swapIndex];
      shuffled[swapIndex] = current;
    }
    return shuffled;
  }

  function currentPair() {
    const leftIndex = state.matchIndex * 2;
    return [
      state.roundEntrants[leftIndex] || null,
      state.roundEntrants[leftIndex + 1] || null,
    ];
  }

  function pairCountForRound() {
    return Math.floor(state.roundEntrants.length / 2);
  }

  function trimHistory() {
    state.history = state.history.slice(0, 8);
  }

  function updateStats() {
    elements.breedCount.textContent = String(state.allBreeds.length);
    elements.totalPicks.textContent = String(state.totalPicks);
    elements.picksLeft.textContent = String(Math.max(state.totalPicks - state.completedPicks, 0));
  }

  function renderHistory() {
    elements.historyList.innerHTML = "";

    if (!state.history.length) {
      const placeholder = document.createElement("li");
      const title = document.createElement("strong");
      const detail = document.createElement("span");
      title.textContent = "Bracket just started";
      detail.textContent = "Every winner you pick will show up here.";
      placeholder.append(title, detail);
      elements.historyList.append(placeholder);
      return;
    }

    state.history.forEach((item) => {
      const row = document.createElement("li");
      const title = document.createElement("strong");
      const detail = document.createElement("span");

      title.textContent = item.winner.name;
      detail.textContent = item.bye
        ? `Moved straight into round ${item.round + 1} with a bye.`
        : `Beat ${item.loser.name} in round ${item.round}.`;

      row.append(title, detail);
      elements.historyList.append(row);
    });
  }

  function populateCard(card, breed) {
    const image = card.querySelector('[data-role="image"]');
    const name = card.querySelector('[data-role="name"]');
    image.src = breed.imagePath;
    image.alt = breed.imageAlt || breed.name;
    name.textContent = breed.name;
  }

  function renderProgress() {
    const percent = state.totalPicks === 0 ? 0 : (state.completedPicks / state.totalPicks) * 100;
    elements.progressFill.style.width = `${percent}%`;
    elements.progressText.textContent = `${state.completedPicks} of ${state.totalPicks} picks complete`;
  }

  function renderMatchup() {
    const [left, right] = currentPair();
    if (!left || !right) {
      return;
    }

    elements.matchupPanel.hidden = false;
    elements.championPanel.hidden = true;

    populateCard(elements.cards[0], left);
    populateCard(elements.cards[1], right);

    const currentRoundPairs = pairCountForRound();
    elements.roundLabel.textContent = `Round ${state.roundNumber} • Match ${state.matchIndex + 1} of ${currentRoundPairs}`;

    if (state.roundEntrants.length % 2 === 1) {
      const byeBreed = state.roundEntrants[state.roundEntrants.length - 1];
      elements.byeNote.textContent = `${byeBreed.name} gets a bye this round if it is left unmatched.`;
    } else {
      elements.byeNote.textContent = "No byes this round.";
    }

    renderProgress();
  }

  function renderChampion() {
    const champion = state.champion;
    if (!champion) {
      return;
    }

    elements.matchupPanel.hidden = true;
    elements.championPanel.hidden = false;
    elements.roundLabel.textContent = "Champion selected";
    elements.byeNote.textContent = "Run another bracket to see whether a different breed wins.";
    elements.championImage.src = champion.imagePath;
    elements.championImage.alt = champion.imageAlt || champion.name;
    elements.championName.textContent = champion.name;
    elements.championSummary.textContent =
      `${champion.name} survived ${state.totalPicks} total picks and came out on top of the full AKC bracket.`;
    elements.championLink.href = champion.breedUrl;
    renderProgress();
  }

  function render() {
    updateStats();
    renderHistory();

    if (state.champion) {
      renderChampion();
      return;
    }

    renderMatchup();
  }

  function advanceRoundIfNeeded() {
    if (state.matchIndex < pairCountForRound()) {
      render();
      return;
    }

    if (state.roundEntrants.length % 2 === 1) {
      const byeBreed = state.roundEntrants[state.roundEntrants.length - 1];
      state.roundWinners.push(byeBreed);
      state.history.unshift({
        round: state.roundNumber,
        winner: byeBreed,
        bye: true,
      });
      trimHistory();
    }

    if (state.roundWinners.length === 1) {
      state.champion = state.roundWinners[0];
      render();
      return;
    }

    state.roundEntrants = state.roundWinners.slice();
    state.roundWinners = [];
    state.roundNumber += 1;
    state.matchIndex = 0;
    render();
  }

  function chooseWinner(side) {
    if (state.champion) {
      return;
    }

    const [left, right] = currentPair();
    if (!left || !right) {
      return;
    }

    const winner = side === "left" ? left : right;
    const loser = side === "left" ? right : left;

    state.roundWinners.push(winner);
    state.history.unshift({
      round: state.roundNumber,
      winner,
      loser,
      bye: false,
    });
    trimHistory();
    state.completedPicks += 1;
    state.matchIndex += 1;
    advanceRoundIfNeeded();
  }

  function startNewBracket() {
    state.roundEntrants = shuffleDogs(state.allBreeds);
    state.roundWinners = [];
    state.roundNumber = 1;
    state.matchIndex = 0;
    state.completedPicks = 0;
    state.champion = null;
    state.history = [];
    render();
  }

  function showError(message) {
    elements.errorMessage.hidden = false;
    elements.errorMessage.textContent = message;
    elements.matchupPanel.hidden = true;
    elements.championPanel.hidden = true;
    elements.roundLabel.textContent = "Data unavailable";
    elements.byeNote.textContent = "";
    renderProgress();
    updateStats();
    renderHistory();
  }

  function bindEvents() {
    elements.cards.forEach((card) => {
      card.addEventListener("click", function () {
        chooseWinner(card.dataset.pick);
      });
    });

    elements.newBracketButton.addEventListener("click", startNewBracket);
    elements.playAgainButton.addEventListener("click", startNewBracket);

    window.addEventListener("keydown", function (event) {
      if (event.key === "ArrowLeft") {
        chooseWinner("left");
      } else if (event.key === "ArrowRight") {
        chooseWinner("right");
      } else if ((event.key === "Enter" || event.key === " ") && state.champion) {
        event.preventDefault();
        startNewBracket();
      }
    });
  }

  bindEvents();

  if (!state.allBreeds.length) {
    showError("No breed data is loaded. Run scripts/scrape_akc_breeds.py first.");
    return;
  }

  startNewBracket();
}());
