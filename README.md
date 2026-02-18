# 🎙️ Dictée Brevet 2026 — Simulateur d'Examen

Version locale optimisée pour **Apple Silicon (M1/M2/M3/M4)** avec synthèse vocale **Kokoro TTS (MLX)**.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Platform](https://img.shields.io/badge/platform-Mac_M4_Pro-lightgrey)
![Language](https://img.shields.io/badge/language-French-red)

## 🌟 Présentation

Ce projet est un simulateur de dictée conçu pour préparer les élèves de 3ème à l'épreuve de français du **Brevet 2026**. Contrairement aux solutions classiques, il utilise une intelligence artificielle locale (**Kokoro TTS via MLX**) pour générer une voix humaine, naturelle et expressive, tout en respectant scrupuleusement le protocole officiel.

### 📜 Protocole Officiel (Respecté à 100%)

1.  **Phase 1 : Lecture intégrale** — Lecture lente pour comprendre le sens du texte.
2.  **Phase 2 : Dictée effective** — Lecture **phrase par phrase** (et non par petits groupes), chaque phrase étant lue **deux fois**.
3.  **Phase 3 : Relecture** — Lecture finale pour les dernières corrections.

---

## 🚀 Caractéristiques

-   **🧠 Voix Ultra-Naturelle** : Utilise Kokoro-82M (MLX) pour une prosodie humaine, loin du ton robotique des voix système.
-   **💻 100% Local** : Aucune donnée ne quitte votre Mac. Pas de clé API, pas de quota cloud.
-   **✍️ Interface Premium** : Design moderne, mode examen, chronomètre et zone d'écriture intuitive.
-   **🔍 Correction Guidée** : Système de comparaison intelligent mettant en évidence les fautes d'accord, de conjugaison et d'orthographe.
-   **⚡ Performance** : Optimisé pour le GPU Metal des puces Apple M-Series (M4 Pro recommandé).

---

## 🛠️ Installation & Lancement

### Prérequis
- Mac avec puce Apple Silicon (M1, M2, M3, M4)
- Docker Desktop installé
- Python 3.10+

### 1. Cloner le projet
```bash
git clone https://github.com/yutaofr/dictee-fr.git
cd dictee-fr
```

### 2. Lancer le serveur de voix (Natif Mac)
Le serveur TTS doit tourner nativement pour accéder au GPU Metal.
```bash
chmod +x tts_server.sh
./tts_server.sh
```
*Note : Le premier lancement télécharge le modèle (~82 Mo) et les dépendances nécessaires.*

### 3. Lancer l'application web (Docker)
Dans un autre terminal :
```bash
docker-compose up --build
```

### 4. Utilisation
Ouvrez votre navigateur sur : **[http://localhost:8081](http://localhost:8081)**

---

## 🏗️ Architecture

```mermaid
graph LR
    A[Navigateur] -- "API /tts" --> B[Node.js Server (Docker)]
    B -- "host.docker.internal" --> C[Python TTS Server (Native)]
    C -- "Metal GPU" --> D[Kokoro-82M MLX Model]
    D -- "Audio WAV" --> C
    C -- "Binary" --> B
    B -- "Stream" --> A
```

---

## 📚 Banque de Dictées
Le fichier `dictees.js` contient une sélection de textes de grands auteurs français (Marcel Pagnol, Victor Hugo, etc.) adaptés au niveau 3ème.

---

## 🤝 Contribution
Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une Issue ou une Pull Request pour ajouter de nouveaux textes ou améliorer l'algorithme de correction.

## 📄 Licence
MIT
