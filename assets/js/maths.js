// Decimal to binary converter for maths.html. Validates before converting, and uses BigInt
// so large whole numbers convert exactly instead of losing precision.

const input = document.getElementById("decimal-input");
const button = document.getElementById("convert-button");
const result = document.getElementById("binary-result");

function convert() {
  const value = input.value.trim();
  if (value === "") {
    result.textContent = "Please enter a number first.";
    return;
  }
  if (!/^\d+$/.test(value)) {
    result.textContent = "Please enter 0 or a positive whole number, using digits only.";
    return;
  }
  const n = BigInt(value);
  result.textContent = `${n} in binary is ${n.toString(2)}.`;
}

button?.addEventListener("click", convert);
input?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") convert();
});
