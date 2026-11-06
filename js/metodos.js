// Modelo: dA/dt = k * (Amax - A)
function f(t, A, k, Amax) {
  return k * (Amax - A);
}

function solucionExacta(t, A0, k, Amax) {
  return Amax - (Amax - A0) * Math.exp(-k * t);
}

function crearPunto(t, A, A0, k, Amax) {
  const exacta = solucionExacta(t, A0, k, Amax);
  const error = Math.abs(exacta - A);
  return {
    t,
    aproximacion: A,
    exacta,
    error,
    errorRelativoPorcentual: exacta === 0 ? null : (error / Math.abs(exacta)) * 100
  };
}

function calcularHeun(A0, Amax, k, T, h) {
  let t = 0;
  let A = A0;
  const puntos = [crearPunto(t, A, A0, k, Amax)];

  while (t < T) {
    const restante = T - t;
    const paso = Math.min(h, restante);
    const k1 = f(t, A, k, Amax);
    const predictor = A + paso * k1;
    const k2 = f(t + paso, predictor, k, Amax);
    A += (paso / 2) * (k1 + k2);
    t = paso === restante ? T : t + paso;
    puntos.push(crearPunto(t, A, A0, k, Amax));
  }
  return puntos;
}

function calcularRK4(A0, Amax, k, T, h) {
  let t = 0;
  let A = A0;
  const puntos = [crearPunto(t, A, A0, k, Amax)];

  while (t < T) {
    const restante = T - t;
    const paso = Math.min(h, restante);
    const k1 = f(t, A, k, Amax);
    const k2 = f(t + paso / 2, A + paso * k1 / 2, k, Amax);
    const k3 = f(t + paso / 2, A + paso * k2 / 2, k, Amax);
    const k4 = f(t + paso, A + paso * k3, k, Amax);

    A += (paso / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    t = paso === restante ? T : t + paso;
    puntos.push(crearPunto(t, A, A0, k, Amax));
  }
  return puntos;
}

window.AdoptaMathMethods = { solucionExacta, calcularHeun, calcularRK4 };
