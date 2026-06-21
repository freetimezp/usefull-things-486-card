const card = document.querySelector(".card");

const glow = document.createElement("div");
glow.classList.add("glow");
card.appendChild(glow);

card.addEventListener("mousemove", (e) => {
    const rect = card.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const rotateY = (x / rect.width - 0.5) * 30;
    const rotateX = (y / rect.height - 0.5) * -30;

    card.style.transform = `
        perspective(1000px)
        rotateX(${rotateX}deg)
        rotateY(${rotateY}deg)
        scale(1.05)
    `;

    glow.style.left = `${x}px`;
    glow.style.top = `${y}px`;
});

card.addEventListener("mouseleave", () => {
    card.style.transform = `
        perspective(1000px)
        rotateX(0)
        rotateY(0)
        scale(1)
    `;
});
