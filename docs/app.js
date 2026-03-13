(function () {
  const breeds = Array.isArray(window.BREEDS) ? window.BREEDS.slice() : [];

  function defaultFilters() {
    return {
      size: "any",
      fluffy: "any",
      shedding: "any",
      energy: "any",
      kids: "any",
      dogs: "any",
      groups: [],
      coatLength: [],
      coatType: [],
    };
  }

  const elements = {
    breedCount: document.getElementById("breed-count"),
    poolCount: document.getElementById("pool-count"),
    totalPicks: document.getElementById("total-picks"),
    picksLeft: document.getElementById("picks-left"),
    errorMessage: document.getElementById("error-message"),
    setupPanel: document.getElementById("setup-panel"),
    statusPanel: document.getElementById("status-panel"),
    matchupPanel: document.getElementById("matchup-panel"),
    championPanel: document.getElementById("champion-panel"),
    historyPanel: document.getElementById("history-panel"),
    roundLabel: document.getElementById("round-label"),
    progressFill: document.getElementById("progress-fill"),
    progressText: document.getElementById("progress-text"),
    activeFilterSummary: document.getElementById("active-filter-summary"),
    byeNote: document.getElementById("bye-note"),
    matchCount: document.getElementById("match-count"),
    filterSummary: document.getElementById("filter-summary"),
    startTournamentButton: document.getElementById("start-tournament-button"),
    resetFiltersButton: document.getElementById("reset-filters-button"),
    changeFiltersButton: document.getElementById("change-filters-button"),
    newBracketButton: document.getElementById("new-bracket-button"),
    championImage: document.getElementById("champion-image"),
    championName: document.getElementById("champion-name"),
    championSummary: document.getElementById("champion-summary"),
    championLink: document.getElementById("champion-link"),
    playAgainButton: document.getElementById("play-again-button"),
    historyList: document.getElementById("history-list"),
    setupFilterRoot: document.getElementById("setup-panel"),
    cards: Array.from(document.querySelectorAll(".dog-card")),
    containers: {
      size: document.getElementById("size-filter"),
      fluffy: document.getElementById("fluffy-filter"),
      groups: document.getElementById("group-filter"),
      coatLength: document.getElementById("coat-length-filter"),
      coatType: document.getElementById("coat-type-filter"),
      shedding: document.getElementById("shedding-filter"),
      energy: document.getElementById("energy-filter"),
      kids: document.getElementById("kids-filter"),
      dogs: document.getElementById("dogs-filter"),
    },
  };

  const filterOptions = {
    size: [
      { value: "any", label: "Any size" },
      { value: "small", label: "Little" },
      { value: "medium", label: "Medium" },
      { value: "large", label: "Big" },
    ],
    fluffy: [
      { value: "any", label: "Any coat" },
      { value: "fluffy", label: "Fluffy" },
      { value: "not_fluffy", label: "Not fluffy" },
    ],
    shedding: [
      { value: "any", label: "Any shedding" },
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
    ],
    energy: [
      { value: "any", label: "Any energy" },
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
    ],
    kids: [
      { value: "any", label: "Any" },
      { value: "low", label: "Lower" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "Great" },
    ],
    dogs: [
      { value: "any", label: "Any" },
      { value: "low", label: "Lower" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "Great" },
    ],
    groups: uniqueValues(function (breed) {
      return breed.breedGroup;
    }).map(function (group) {
      return {
        value: group,
        label: group.replace(/ Group$/, ""),
      };
    }),
    coatLength: uniqueValues(function (breed) {
      return (breed.traits && breed.traits.coatLength) || [];
    }).map(function (value) {
      return { value: value, label: value };
    }),
    coatType: uniqueValues(function (breed) {
      return (breed.traits && breed.traits.coatType) || [];
    }).map(function (value) {
      return { value: value, label: value };
    }),
  };

  const state = {
    allBreeds: breeds,
    filteredBreeds: breeds.slice(),
    filters: defaultFilters(),
    phase: "setup",
    pool: [],
    roundEntrants: [],
    roundWinners: [],
    roundNumber: 1,
    matchIndex: 0,
    completedPicks: 0,
    totalPicks: Math.max(0, breeds.length - 1),
    champion: null,
    history: [],
  };

  function uniqueValues(reader) {
    const values = new Set();
    breeds.forEach(function (breed) {
      const result = reader(breed);
      if (Array.isArray(result)) {
        result.forEach(function (item) {
          if (item) {
            values.add(item);
          }
        });
        return;
      }

      if (result) {
        values.add(result);
      }
    });

    return Array.from(values).sort(function (left, right) {
      return left.localeCompare(right);
    });
  }

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

  function scoreBucket(score) {
    if (typeof score !== "number") {
      return "unknown";
    }
    if (score <= 2) {
      return "low";
    }
    if (score === 3) {
      return "medium";
    }
    return "high";
  }

  function overlap(values, selected) {
    return selected.some(function (item) {
      return values.includes(item);
    });
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

  function activeFilterTokens() {
    const tokens = [];

    if (state.filters.size !== "any") {
      tokens.push(state.filters.size === "small" ? "Little dogs" : state.filters.size === "large" ? "Big dogs" : "Medium dogs");
    }

    if (state.filters.fluffy === "fluffy") {
      tokens.push("Fluffy coats");
    } else if (state.filters.fluffy === "not_fluffy") {
      tokens.push("Not fluffy");
    }

    if (state.filters.groups.length) {
      tokens.push(state.filters.groups.join(", "));
    }

    if (state.filters.coatLength.length) {
      tokens.push(state.filters.coatLength.join(" / ") + " coats");
    }

    if (state.filters.coatType.length) {
      tokens.push(state.filters.coatType.join(" / ") + " coat types");
    }

    if (state.filters.shedding !== "any") {
      tokens.push(state.filters.shedding + " shedding");
    }

    if (state.filters.energy !== "any") {
      tokens.push(state.filters.energy + " energy");
    }

    if (state.filters.kids !== "any") {
      tokens.push((state.filters.kids === "high" ? "Great" : state.filters.kids === "medium" ? "Medium" : "Lower") + " with kids");
    }

    if (state.filters.dogs !== "any") {
      tokens.push((state.filters.dogs === "high" ? "Great" : state.filters.dogs === "medium" ? "Medium" : "Lower") + " with dogs");
    }

    return tokens;
  }

  function filterSummaryText() {
    const tokens = activeFilterTokens();
    if (!tokens.length) {
      return "All breeds are currently included.";
    }
    return "Using: " + tokens.join(" • ");
  }

  function applyFilters() {
    state.filteredBreeds = state.allBreeds.filter(function (breed) {
      const traits = breed.traits || {};
      const coatLength = traits.coatLength || [];
      const coatType = traits.coatType || [];

      if (state.filters.size !== "any" && breed.sizeCategory !== state.filters.size) {
        return false;
      }

      if (state.filters.fluffy === "fluffy" && !breed.isFluffy) {
        return false;
      }

      if (state.filters.fluffy === "not_fluffy" && breed.isFluffy) {
        return false;
      }

      if (state.filters.groups.length && !state.filters.groups.includes(breed.breedGroup)) {
        return false;
      }

      if (state.filters.coatLength.length && !overlap(coatLength, state.filters.coatLength)) {
        return false;
      }

      if (state.filters.coatType.length && !overlap(coatType, state.filters.coatType)) {
        return false;
      }

      if (state.filters.shedding !== "any" && scoreBucket(traits.sheddingLevel) !== state.filters.shedding) {
        return false;
      }

      if (state.filters.energy !== "any" && scoreBucket(traits.energyLevel) !== state.filters.energy) {
        return false;
      }

      if (
        state.filters.kids !== "any" &&
        scoreBucket(traits.goodWithYoungChildren) !== state.filters.kids
      ) {
        return false;
      }

      if (
        state.filters.dogs !== "any" &&
        scoreBucket(traits.goodWithOtherDogs) !== state.filters.dogs
      ) {
        return false;
      }

      return true;
    });

    state.totalPicks = Math.max(state.filteredBreeds.length - 1, 0);
  }

  function updateStats() {
    const poolCount = state.phase === "setup" ? state.filteredBreeds.length : state.pool.length;
    const totalPicks = state.phase === "setup" ? Math.max(poolCount - 1, 0) : state.totalPicks;
    const picksLeft = state.phase === "setup" ? totalPicks : Math.max(state.totalPicks - state.completedPicks, 0);

    elements.breedCount.textContent = String(state.allBreeds.length);
    elements.poolCount.textContent = String(poolCount);
    elements.totalPicks.textContent = String(totalPicks);
    elements.picksLeft.textContent = String(picksLeft);
  }

  function createChoicePill(key, mode, option, isSelected) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-pill";
    button.dataset.filterKey = key;
    button.dataset.filterMode = mode;
    button.dataset.filterValue = option.value;
    button.textContent = option.label;
    button.setAttribute("aria-pressed", isSelected ? "true" : "false");

    if (isSelected) {
      button.classList.add("is-selected");
    }

    return button;
  }

  function renderChoiceGroup(container, key, mode, options) {
    container.innerHTML = "";
    options.forEach(function (option) {
      const isSelected = mode === "single"
        ? state.filters[key] === option.value
        : state.filters[key].includes(option.value);
      container.appendChild(createChoicePill(key, mode, option, isSelected));
    });
  }

  function renderFilters() {
    renderChoiceGroup(elements.containers.size, "size", "single", filterOptions.size);
    renderChoiceGroup(elements.containers.fluffy, "fluffy", "single", filterOptions.fluffy);
    renderChoiceGroup(elements.containers.shedding, "shedding", "single", filterOptions.shedding);
    renderChoiceGroup(elements.containers.energy, "energy", "single", filterOptions.energy);
    renderChoiceGroup(elements.containers.kids, "kids", "single", filterOptions.kids);
    renderChoiceGroup(elements.containers.dogs, "dogs", "single", filterOptions.dogs);
    renderChoiceGroup(elements.containers.groups, "groups", "multi", filterOptions.groups);
    renderChoiceGroup(elements.containers.coatLength, "coatLength", "multi", filterOptions.coatLength);
    renderChoiceGroup(elements.containers.coatType, "coatType", "multi", filterOptions.coatType);
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

    state.history.forEach(function (item) {
      const row = document.createElement("li");
      const title = document.createElement("strong");
      const detail = document.createElement("span");

      title.textContent = item.winner.name;
      detail.textContent = item.bye
        ? "Moved straight into round " + (item.round + 1) + " with a bye."
        : "Beat " + item.loser.name + " in round " + item.round + ".";

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
    elements.progressFill.style.width = percent + "%";
    elements.progressText.textContent = state.completedPicks + " of " + state.totalPicks + " picks complete";
  }

  function renderSetup() {
    elements.setupPanel.hidden = false;
    elements.statusPanel.hidden = true;
    elements.matchupPanel.hidden = true;
    elements.championPanel.hidden = true;
    elements.historyPanel.hidden = true;
    elements.changeFiltersButton.hidden = true;
    elements.newBracketButton.hidden = true;

    const matchingBreeds = state.filteredBreeds.length;
    elements.matchCount.textContent = matchingBreeds + " breed" + (matchingBreeds === 1 ? "" : "s") + " match";
    elements.filterSummary.textContent = filterSummaryText();
    elements.startTournamentButton.disabled = matchingBreeds < 2;
    elements.startTournamentButton.textContent = matchingBreeds < 2 ? "Need at least 2 breeds" : "Start tournament";
  }

  function renderMatchup() {
    const pair = currentPair();
    const left = pair[0];
    const right = pair[1];

    if (!left || !right) {
      return;
    }

    elements.matchupPanel.hidden = false;
    elements.championPanel.hidden = true;

    populateCard(elements.cards[0], left);
    populateCard(elements.cards[1], right);

    elements.roundLabel.textContent =
      "Round " + state.roundNumber + " • Match " + (state.matchIndex + 1) + " of " + pairCountForRound();

    if (state.roundEntrants.length % 2 === 1) {
      const byeBreed = state.roundEntrants[state.roundEntrants.length - 1];
      elements.byeNote.textContent = byeBreed.name + " gets a bye this round if it is left unmatched.";
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
    elements.byeNote.textContent = "Adjust the filters or shuffle this pool to run another bracket.";
    elements.championImage.src = champion.imagePath;
    elements.championImage.alt = champion.imageAlt || champion.name;
    elements.championName.textContent = champion.name;
    elements.championSummary.textContent =
      champion.name +
      " won a " +
      state.pool.length +
      "-breed bracket after " +
      state.totalPicks +
      " total picks.";
    elements.championLink.href = champion.breedUrl;
    renderProgress();
  }

  function renderTournament() {
    elements.setupPanel.hidden = true;
    elements.statusPanel.hidden = false;
    elements.historyPanel.hidden = false;
    elements.changeFiltersButton.hidden = false;
    elements.newBracketButton.hidden = false;
    elements.activeFilterSummary.textContent = filterSummaryText();
    renderHistory();

    if (state.champion) {
      renderChampion();
      return;
    }

    renderMatchup();
  }

  function render() {
    updateStats();
    if (state.phase === "setup") {
      renderSetup();
      return;
    }
    renderTournament();
  }

  function resetBracketState(pool) {
    state.phase = "tournament";
    state.pool = pool.slice();
    state.roundEntrants = shuffleDogs(pool);
    state.roundWinners = [];
    state.roundNumber = 1;
    state.matchIndex = 0;
    state.completedPicks = 0;
    state.totalPicks = Math.max(pool.length - 1, 0);
    state.champion = null;
    state.history = [];
  }

  function startTournament() {
    if (state.filteredBreeds.length < 2) {
      return;
    }
    resetBracketState(state.filteredBreeds);
    render();
  }

  function startNewBracket() {
    if (state.filteredBreeds.length < 2) {
      state.phase = "setup";
      render();
      return;
    }
    resetBracketState(state.filteredBreeds);
    render();
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
    if (state.phase !== "tournament" || state.champion) {
      return;
    }

    const pair = currentPair();
    const left = pair[0];
    const right = pair[1];

    if (!left || !right) {
      return;
    }

    const winner = side === "left" ? left : right;
    const loser = side === "left" ? right : left;

    state.roundWinners.push(winner);
    state.history.unshift({
      round: state.roundNumber,
      winner: winner,
      loser: loser,
      bye: false,
    });
    trimHistory();
    state.completedPicks += 1;
    state.matchIndex += 1;
    advanceRoundIfNeeded();
  }

  function resetFilters() {
    state.filters = defaultFilters();
    applyFilters();
    renderFilters();
    render();
  }

  function showSetup() {
    state.phase = "setup";
    state.champion = null;
    state.history = [];
    render();
  }

  function handleChoiceClick(target) {
    const key = target.dataset.filterKey;
    const value = target.dataset.filterValue;
    const mode = target.dataset.filterMode;

    if (!key || !value || !mode) {
      return;
    }

    if (mode === "single") {
      state.filters[key] = value;
    } else {
      const values = state.filters[key].slice();
      const existingIndex = values.indexOf(value);
      if (existingIndex >= 0) {
        values.splice(existingIndex, 1);
      } else {
        values.push(value);
      }
      state.filters[key] = values;
    }

    applyFilters();
    renderFilters();
    render();
  }

  function showError(message) {
    elements.errorMessage.hidden = false;
    elements.errorMessage.textContent = message;
    elements.setupPanel.hidden = true;
    elements.statusPanel.hidden = true;
    elements.matchupPanel.hidden = true;
    elements.championPanel.hidden = true;
    elements.historyPanel.hidden = true;
    elements.changeFiltersButton.hidden = true;
    elements.newBracketButton.hidden = true;
  }

  function bindEvents() {
    elements.setupFilterRoot.addEventListener("click", function (event) {
      const button = event.target.closest(".choice-pill");
      if (!button) {
        return;
      }
      handleChoiceClick(button);
    });

    elements.startTournamentButton.addEventListener("click", startTournament);
    elements.resetFiltersButton.addEventListener("click", resetFilters);
    elements.changeFiltersButton.addEventListener("click", showSetup);
    elements.newBracketButton.addEventListener("click", startNewBracket);
    elements.playAgainButton.addEventListener("click", startNewBracket);

    elements.cards.forEach(function (card) {
      card.addEventListener("click", function () {
        chooseWinner(card.dataset.pick);
      });
    });

    window.addEventListener("keydown", function (event) {
      if (state.phase === "tournament" && !state.champion) {
        if (event.key === "ArrowLeft") {
          chooseWinner("left");
        } else if (event.key === "ArrowRight") {
          chooseWinner("right");
        }
        return;
      }

      if (state.champion && (event.key === "Enter" || event.key === " ")) {
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

  applyFilters();
  renderFilters();
  render();
}());
