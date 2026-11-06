(() => {
  const $ = (id) => document.getElementById(id);
  let comparisonChart = null;
  let errorChart = null;

  const views = {
    inicio: { title: "Resumen general", id: "view-inicio" },
    simulador: { title: "Nueva simulación", id: "view-simulador" },
    historial: { title: "Historial", id: "view-historial" }
  };

  function navigate(view) {
    Object.entries(views).forEach(([key, item]) => {
      $(item.id).classList.toggle("active", key === view);
    });
    document.querySelectorAll(".nav-item").forEach(button => {
      button.classList.toggle("active", button.dataset.view === view);
    });
    $("pageTitle").textContent = views[view].title;
    if (view === "historial") loadHistory();
    if (view === "inicio") loadDashboard();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.querySelectorAll("[data-view]").forEach(button =>
    button.addEventListener("click", () => navigate(button.dataset.view))
  );
  document.querySelectorAll("[data-go]").forEach(button =>
    button.addEventListener("click", () => navigate(button.dataset.go))
  );
  $("newSimulationTop").addEventListener("click", () => navigate("simulador"));
  $("refreshHistory").addEventListener("click", loadHistory);
  $("closeHistoryDetail").addEventListener("click", () => $("historyDetailDialog").close());

  function setMessage(message, type = "") {
    const element = $("formMessage");
    element.textContent = message;
    element.className = `form-message ${type}`;
  }

  function validateInputs() {
    const values = {
      nombre: $("nombre").value.trim(),
      A0: Number($("inicial").value),
      Amax: Number($("meta").value),
      k: Number($("tasa").value),
      T: Number($("tiempo").value),
      h1: Number($("paso1").value),
      h2: Number($("paso2").value)
    };
    if (!values.nombre || values.nombre.length > 120) {
      throw new Error("Escribe un nombre válido (máximo 120 caracteres).");
    }
    if (![values.A0, values.Amax, values.k, values.T, values.h1, values.h2].every(Number.isFinite)) {
      throw new Error("Todos los parámetros deben ser números válidos.");
    }
    if (values.A0 < 0 || values.Amax <= 0 || values.A0 > values.Amax) {
      throw new Error("La meta debe ser positiva y mayor o igual que las adopciones iniciales.");
    }
    if (values.k <= 0 || values.T <= 0 || values.h1 <= 0 || values.h2 <= 0) {
      throw new Error("La tasa, el tiempo y los tamaños de paso deben ser mayores que cero.");
    }
    if (values.h1 === values.h2) {
      throw new Error("Ingresa dos tamaños de paso diferentes para comparar.");
    }
    if (values.T / Math.min(values.h1, values.h2) > 2000) {
      throw new Error("El tamaño de paso generaría más de 2.000 iteraciones. Usa un paso mayor.");
    }
    return values;
  }

  function calculateAll(values) {
    const exact = AdoptaMathMethods.solucionExacta(values.T, values.A0, values.k, values.Amax);
    const records = [];
    for (const h of [values.h1, values.h2]) {
      records.push({
        method: "Heun",
        h,
        points: AdoptaMathMethods.calcularHeun(values.A0, values.Amax, values.k, values.T, h)
      });
      records.push({
        method: "RK4",
        h,
        points: AdoptaMathMethods.calcularRK4(values.A0, values.Amax, values.k, values.T, h)
      });
    }
    if (records.some(record => record.points.some(point =>
      ![point.t, point.aproximacion, point.exacta, point.error].every(Number.isFinite) ||
      (point.errorRelativoPorcentual !== null && !Number.isFinite(point.errorRelativoPorcentual))
    ))) {
      throw new Error("Estos parámetros producen valores fuera del rango numérico. Revisa la tasa, la meta y los tamaños de paso.");
    }
    return { exact, records };
  }

  function formatNumber(value, digits = 8) {
    return Number(value).toFixed(digits);
  }

  function appendCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value;
    row.appendChild(cell);
  }

  function renderComparisonChart(values, records) {
    const colors = { Heun: "#e4a64d", RK4: "#548bd1" };
    const exactRecord = records.reduce((best, record) => record.h < best.h ? record : best);
    const datasets = [{
      label: "Solución analítica",
      data: exactRecord.points.map(point => ({ x: point.t, y: point.exacta })),
      borderColor: "#1b7655",
      backgroundColor: "#1b7655",
      borderWidth: 3,
      pointRadius: 0,
      tension: .2
    }];
    records.forEach(record => datasets.push({
      label: `${record.method} (h=${record.h} meses)`,
      data: record.points.map(point => ({ x: point.t, y: point.aproximacion })),
      borderColor: colors[record.method],
      backgroundColor: colors[record.method],
      borderWidth: 2,
      pointRadius: 0,
      tension: 0
    }));

    if (comparisonChart) comparisonChart.destroy();
    comparisonChart = new Chart($("comparisonChart"), {
      type: "line",
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        interaction: { intersect: false, mode: "nearest", axis: "x" },
        plugins: {
          legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 7, font: { family: "DM Sans", size: 11 } } }
        },
        scales: {
          x: { type: "linear", min: 0, max: values.T, title: { display: true, text: "Tiempo (meses)" }, grid: { color: "#edf1ee" } },
          y: { title: { display: true, text: "Adopciones acumuladas" }, beginAtZero: true, grid: { color: "#edf1ee" } }
        }
      }
    });
  }

  function renderErrorChart(records, finalTime) {
    const colors = { Heun: "#e4a64d", RK4: "#548bd1" };
    const datasets = records.map(record => ({
      label: `${record.method} (h=${record.h} meses)`,
      data: record.points.map(point => ({ x: point.t, y: point.error })),
      borderColor: colors[record.method],
      backgroundColor: colors[record.method],
      borderWidth: 2,
      pointRadius: 0,
      tension: 0
    }));
    if (errorChart) errorChart.destroy();
    errorChart = new Chart($("errorChart"), {
      type: "line",
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        interaction: { intersect: false, mode: "nearest", axis: "x" },
        plugins: {
          legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 7, font: { family: "DM Sans", size: 11 } } }
        },
        scales: {
          x: { type: "linear", min: 0, max: finalTime, title: { display: true, text: "Tiempo (meses)" }, grid: { color: "#edf1ee" } },
          y: { title: { display: true, text: "Error absoluto (adopciones)" }, beginAtZero: true, grid: { color: "#edf1ee" } }
        }
      }
    });
  }

  function renderSummaryTable(records, exact) {
    const body = $("resultsTable");
    body.replaceChildren();
    records.forEach(record => {
      const last = record.points[record.points.length - 1];
      const row = document.createElement("tr");
      [
        record.method,
        record.h,
        record.points.length - 1,
        formatNumber(last.aproximacion),
        formatNumber(exact),
        formatNumber(last.error, 10),
        last.errorRelativoPorcentual === null ? "—" : formatNumber(last.errorRelativoPorcentual, 6)
      ].forEach(value => appendCell(row, String(value)));
      body.appendChild(row);
    });
  }

  function renderIterationTable(record) {
    const body = $("iterationsTable");
    body.replaceChildren();
    record.points.forEach((point, index) => {
      const row = document.createElement("tr");
      [
        index,
        formatNumber(point.t, 6),
        formatNumber(point.exacta),
        formatNumber(point.aproximacion),
        formatNumber(point.error, 10),
        point.errorRelativoPorcentual === null ? "—" : formatNumber(point.errorRelativoPorcentual, 6)
      ].forEach(value => appendCell(row, String(value)));
      body.appendChild(row);
    });
  }

  function renderInterpretation(values, records, exact) {
    const best = records.reduce((current, record) => {
      const error = record.points[record.points.length - 1].error;
      return error < current.error ? { record, error } : current;
    }, { record: records[0], error: records[0].points[records[0].points.length - 1].error });
    const reached = values.Amax === 0 ? 0 : (exact / values.Amax) * 100;
    $("interpretationText").textContent =
      `Con los supuestos ingresados, la solución analítica estima ${formatNumber(exact, 2)} adopciones acumuladas al cabo de ${values.T} meses, aproximadamente ${formatNumber(reached, 2)}% de la meta. ` +
      `${best.record.method} con h=${best.record.h} meses obtuvo el menor error absoluto final (${formatNumber(best.error, 10)} adopciones) en esta comparación. ` +
      `Al reducir h, normalmente mejora la aproximación, aunque aumenta el número de cálculos. Estos resultados describen el modelo, no garantizan el comportamiento real de una campaña.`;
    $("bestError").textContent = formatNumber(best.error, 8);
    $("bestMethod").textContent = `${best.record.method}, h = ${best.record.h} meses`;
  }

  function renderResults(values, result, durationMs) {
    $("resultsSection").classList.remove("hidden");
    $("exactFinal").textContent = formatNumber(result.exact, 6);
    $("calculationTime").textContent = `${formatNumber(durationMs, 3)} ms`;
    renderSummaryTable(result.records, result.exact);
    renderComparisonChart(values, result.records);
    renderErrorChart(result.records, values.T);
    renderInterpretation(values, result.records, result.exact);

    const select = $("iterationSelect");
    select.replaceChildren();
    result.records.forEach((record, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${record.method}, h = ${record.h} meses`;
      select.appendChild(option);
    });
    select.onchange = () => renderIterationTable(result.records[Number(select.value)]);
    renderIterationTable(result.records[0]);
    $("resultsSection").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveSimulation(values, result) {
    if (!window.db) {
      throw new Error("Supabase no está configurado. Revisa js/supabase.js y coloca tu clave sb_publishable_.");
    }
    const { data: simulation, error: simulationError } = await db
      .from("simulaciones")
      .insert([{
        nombre: values.nombre,
        adopciones_iniciales: values.A0,
        meta_maxima: values.Amax,
        tasa_adopcion: values.k,
        tiempo_final: values.T
      }])
      .select("id, nombre, created_at")
      .single();
    if (simulationError) throw simulationError;

    const rows = result.records.map(record => ({
      simulacion_id: simulation.id,
      metodo: record.method,
      paso: record.h,
      datos: {
        puntos: record.points,
        solucion_analitica_final: result.exact,
        iteraciones: record.points.length - 1,
        parametros: { A0: values.A0, Amax: values.Amax, k: values.k, T: values.T }
      }
    }));
    const { error: resultsError } = await db.from("resultados").insert(rows);
    if (resultsError) {
      throw new Error(`La simulación se guardó con ID ${simulation.id}, pero falló el guardado de resultados: ${resultsError.message}`);
    }
    return simulation;
  }

  $("simulationForm").addEventListener("submit", async event => {
    event.preventDefault();
    $("runButton").disabled = true;
    $("runButton").textContent = "Calculando y guardando...";
    setMessage("");
    let calculationComplete = false;
    try {
      const values = validateInputs();
      const start = performance.now();
      const result = calculateAll(values);
      const durationMs = performance.now() - start;
      renderResults(values, result, durationMs);
      calculationComplete = true;
      $("savedBadge").textContent = "Resultados calculados";
      $("savedBadge").classList.remove("not-saved");
      setMessage("Cálculo completado. Guardando los datos en Supabase...");
      const saved = await saveSimulation(values, result);
      $("savedBadge").textContent = "✓ Guardado en Supabase";
      setMessage(`¡Simulación y cuatro conjuntos de resultados guardados! ID: ${saved.id}`, "success");
      await loadDashboard();
    } catch (error) {
      console.error(error);
      if (calculationComplete) {
        $("savedBadge").textContent = "No guardado en Supabase";
        $("savedBadge").classList.add("not-saved");
        setMessage(`Los resultados se calcularon, pero no se guardaron: ${error.message}`, "error");
      } else {
        setMessage(error.message || "Ocurrió un error inesperado.", "error");
      }
    } finally {
      $("runButton").disabled = false;
      $("runButton").innerHTML = 'Calcular y guardar resultados <span>→</span>';
    }
  });

  async function showHistoryDetail(simulation) {
    $("historyDetailTitle").textContent = simulation.nombre;
    $("historyDetailContent").textContent = "Cargando resultados...";
    $("historyDetailDialog").showModal();
    const { data, error } = await db
      .from("resultados")
      .select("metodo,paso,datos,created_at")
      .eq("simulacion_id", simulation.id)
      .order("paso", { ascending: true });
    if (error) {
      $("historyDetailContent").textContent = `No se pudieron cargar los resultados: ${error.message}`;
      return;
    }
    const table = document.createElement("table");
    table.innerHTML = "<thead><tr><th>Método</th><th>Paso (meses)</th><th>Iteraciones</th><th>Resultado final</th><th>Error absoluto</th><th>Error relativo (%)</th></tr></thead>";
    const body = document.createElement("tbody");
    data.forEach(item => {
      const points = item.datos?.puntos || [];
      const last = points[points.length - 1];
      const row = document.createElement("tr");
      [
        item.metodo,
        item.paso,
        item.datos?.iteraciones ?? Math.max(0, points.length - 1),
        last ? formatNumber(last.aproximacion) : "—",
        last ? formatNumber(last.error, 10) : "—",
        last?.errorRelativoPorcentual == null ? "—" : formatNumber(last.errorRelativoPorcentual, 6)
      ].forEach(value => appendCell(row, String(value)));
      body.appendChild(row);
    });
    table.appendChild(body);
    const content = $("historyDetailContent");
    content.replaceChildren(table);
    if (data.length === 0) content.textContent = "Esta simulación no tiene resultados guardados.";
  }

  async function loadHistory() {
    const body = $("historyTable");
    body.innerHTML = '<tr><td colspan="8" class="empty-cell">Cargando historial...</td></tr>';
    $("historyMessage").textContent = "";
    if (!window.db) {
      body.innerHTML = '<tr><td colspan="8" class="empty-cell">Configura Supabase en js/supabase.js.</td></tr>';
      return;
    }
    const { data, error } = await db
      .from("simulaciones")
      .select("id,nombre,adopciones_iniciales,meta_maxima,tasa_adopcion,tiempo_final,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      body.innerHTML = '<tr><td colspan="8" class="empty-cell">No se pudo cargar el historial.</td></tr>';
      $("historyMessage").textContent = error.message;
      $("historyMessage").className = "form-message error";
      return;
    }
    body.replaceChildren();
    if (!data.length) {
      body.innerHTML = '<tr><td colspan="8" class="empty-cell">Todavía no hay simulaciones guardadas.</td></tr>';
      return;
    }
    data.forEach(item => {
      const row = document.createElement("tr");
      const date = item.created_at ? new Date(item.created_at).toLocaleString("es-BO") : "—";
      [
        item.id,
        item.nombre,
        item.adopciones_iniciales,
        item.meta_maxima,
        item.tasa_adopcion,
        item.tiempo_final,
        date
      ].forEach((value, index) => {
        const cell = document.createElement("td");
        cell.textContent = String(value);
        if (index === 6) cell.className = "history-date";
        row.appendChild(cell);
      });
      const detailCell = document.createElement("td");
      const detailButton = document.createElement("button");
      detailButton.type = "button";
      detailButton.className = "button button-secondary button-small";
      detailButton.textContent = "Ver resultados";
      detailButton.addEventListener("click", () => showHistoryDetail(item));
      detailCell.appendChild(detailButton);
      row.appendChild(detailCell);
      body.appendChild(row);
    });
  }

  async function loadDashboard() {
    if (!window.db) {
      $("connectionLabel").textContent = "Falta configurar Supabase";
      $("connectionLabel").previousElementSibling.classList.remove("online");
      $("statSimulations").textContent = "—";
      $("statLast").textContent = "—";
      return;
    }
    const [countResult, latestResult] = await Promise.all([
      db.from("simulaciones").select("*", { count: "exact", head: true }),
      db.from("simulaciones").select("id,nombre,created_at").order("created_at", { ascending: false }).limit(1)
    ]);
    if (countResult.error || latestResult.error) {
      const error = countResult.error || latestResult.error;
      $("connectionLabel").textContent = "Error de conexión";
      $("connectionLabel").previousElementSibling.classList.remove("online");
      $("historyMessage").textContent = error.message;
      $("historyMessage").className = "form-message error";
      console.error(error);
      return;
    }
    $("connectionLabel").textContent = "Base de datos conectada";
    $("connectionLabel").previousElementSibling.classList.add("online");
    $("statSimulations").textContent = countResult.count ?? "—";
    $("statLast").textContent = latestResult.data[0]?.nombre || "Sin registros";
  }

  $("historyDetailDialog").addEventListener("click", event => {
    if (event.target === $("historyDetailDialog")) $("historyDetailDialog").close();
  });

  loadDashboard();
})();
