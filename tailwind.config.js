/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      width: {
        1.5: "0.375rem", // 6px
      },
      colors: {
        primary: {
          light: "#61dafb",
          dark: "#61dafb",
        },
        background: {
          light: "#ffffff",
          dark: "#1a1a1a",
        },
        sidebar: {
          light: "#f5f5f5",
          dark: "#1a1a1a",
        },
        border: {
          light: "#e0e0e0",
          dark: "#3c3c3c",
        },
        text: {
          light: "#333333",
          dark: "#e0e0e0",
        },
      },
    },
  },
  plugins: [],
};
