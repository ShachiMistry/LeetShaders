# LeetShaders

A browser-native GLSL shader coding challenge platform with a hybrid AI-powered judging system.

## Overview

LeetShaders is a platform where users can practice and master shader graphics programming. Think of it as "LeetCode for Shaders." It provides a real-time GLSL editor, a live preview, and a sophisticated judging system that validates your visual output against reference solutions.

### The Hybrid Judge

The hardest problem in shader education is automated grading. LeetShaders solves this using a two-stage pipeline:
1.  **Pixel Comparison (MAE):** Fast, cheap calculation of mean absolute error.
2.  **AI Vision Model (Claude Opus 4.7):** Borderline cases and potential "cheating" (e.g., hardcoded textures) are analyzed by a state-of-the-art LLM to ensure fair and accurate scoring.

## Tech Stack

- **Frontend:** React 19, Vite, Material UI v7
- **Graphics:** Raw WebGL2 (no abstractions)
- **Editor:** Monaco Editor (@monaco-editor/react)
- **Backend:** Supabase (Auth, Postgres, RLS)
- **AI:** Anthropic Claude API (Opus for judging, Sonnet for hints)

## Project Structure

- `src/judge/`: WebGL2 rendering pipeline and scoring logic.
- `src/editor/`: Monaco editor integration and GLSL syntax highlighting.
- `src/ai/`: Prompt engineering and LLM evaluation harnesses.
- `src/backend/`: Supabase integration and data hooks.
- `src/challenges/`: Curated GLSL challenge bank.

## Team & Roles

This project is organized into four key leadership roles:
- **Judge & Rendering Lead:** WebGL pipeline and MAE scoring.
- **AI Systems & Integration:** LLM judge prompts and hint systems.
- **Editor & UI Lead:** Monaco integration and core user experience.
- **Content & Backend Lead:** Challenge authoring and Supabase infrastructure.

---

*This project is being developed as a CMPE Final Project.*
