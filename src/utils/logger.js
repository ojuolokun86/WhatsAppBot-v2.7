const styles = {
    default: (message) => `╔══════════════════╗\n║ 🚀 **TECHITOON BOT** 🚀 ║\n╚══════════════════╝\n\n${message}\n\n╭━ ⋅☆⋅ ━╮\n  🤖 **Techitoon AI**\n╰━ ⋅☆⋅ ━╯`,
    fancy: (message) => `╔══════════════════╗\n║ 🚀 **𝓣𝓔𝓒𝓗𝕀𝕋𝕆𝕆ℕ 𝔹𝕆𝕋** 🚀 ║\n╚══════════════════╝\n\n${message}\n\n╭━ ⋅☆⋅ ━╮\n  🤖 **𝓣𝓮𝓬𝓱𝓲𝓽𝓸𝓸𝓷 𝓐𝓘**\n╰━ ⋅☆⋅ ━╯`,
    stylish: (message) => `╔══════════════════╗\n║ 🚀 **𝕋𝔼ℂℍ𝕀𝕋𝕆𝕆ℕ 𝔹𝕆𝕋** 🚀 ║\n╚══════════════════╝\n\n${message}\n\n╭━ ⋅☆⋅ ━╮\n  🤖 **𝕋𝕖𝕔𝕙𝕚𝕥𝕠𝕠𝕟 𝔸𝕀**\n╰━ ⋅☆⋅ ━╯`,
    big: (message) => `╔══════════════════╗\n║ 🚀 **ＴＥＣＨＩＴＯＯＮ ＢＯＴ** 🚀 ║\n╚══════════════════╝\n\n${message}\n\n╭━ ⋅☆⋅ ━╮\n  🤖 **Ｔｅｃｈｉｔｏｏｎ ＡＩ**\n╰━ ⋅☆⋅ ━╯`,
    modern: (message) => `╔══════════════════╗\n║ 🚀 **Modern Bot** 🚀 ║\n╚══════════════════╝\n\n${message}\n\n╭━ ⋅☆⋅ ━╮\n  🤖 **Modern AI**\n╰━ ⋅☆⋅ ━╯`,
    classic: (message) => `╔══════════════════╗\n║ 🚀 **Classic Bot** 🚀 ║\n╚══════════════════╝\n\n${message}\n\n╭━ ⋅☆⋅ ━╮\n  🤖 **Classic AI**\n╰━ ⋅☆⋅ ━╯`
};

let currentStyle = styles.default;

function formatMessage(message) {
    return currentStyle(message);
}

module.exports = {
    formatMessage,
    styles,
    setStyle: (styleName) => {
        if (styles[styleName]) {
            currentStyle = styles[styleName];
        }
    },
    listStyles: () => Object.keys(styles),
    resetStyle: () => {
        currentStyle = styles.default;
    }
};