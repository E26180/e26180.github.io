// Scrollytelling for the lab page: as each lab scrolls into the middle of the screen the
// diagram next to it lights up the parts that lab was about. The diagram is decorative
// (the same story is in the text), so this only toggles a data attribute.

const figure = document.getElementById("diagram");
const now = document.getElementById("diagram-now");
const steps = [...document.querySelectorAll(".step[data-step]")];

function setStep(n) {
  if (!n || figure.dataset.step === String(n)) return;
  figure.dataset.step = String(n);
  const step = steps.find((s) => s.dataset.step === String(n));
  if (now && step) {
    const title = step.querySelector("h2")?.textContent.trim() ?? "";
    now.textContent = `Lab ${String(n).padStart(2, "0")} / ${String(steps.length).padStart(2, "0")} · ${title}`;
  }
}

if (figure && steps.length) {
  // a link such as /lab/#lab-3 should open with that lab already lit
  const fromHash = location.hash.match(/^#lab-(\d)$/);
  if (fromHash) setStep(Number(fromHash[1]));

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).pop();
        if (hit) setStep(Number(hit.target.dataset.step));
      },
      { rootMargin: "-42% 0px -42% 0px" },
    );
    steps.forEach((s) => io.observe(s));
  }
}
