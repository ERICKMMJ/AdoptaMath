(() => {
  const $ = (id) => document.getElementById(id);
  const charts = {};
  const rowsPerPage = 15;
  const tablePages = {};

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

  function renderPaginatedRows(bodyId, rows) {
    const body = $(bodyId);
    const pagination = $(`${bodyId}Pagination`);
    const pageCount = Math.ceil(rows.length / rowsPerPage);
    const page = Math.min(tablePages[bodyId] || 1, pageCount || 1);
    tablePages[bodyId] = page;
    body.replaceChildren(...rows.slice((page - 1) * rowsPerPage, page * rowsPerPage));

    pagination.replaceChildren();
    pagination.classList.toggle("hidden", rows.length <= rowsPerPage);
    if (rows.length <= rowsPerPage) return;

    const range = document.createElement("span");
    range.className = "table-pagination-status";
    range.setAttribute("aria-live", "polite");
    range.textContent =
      `Mostrando ${(page - 1) * rowsPerPage + 1}–${Math.min(page * rowsPerPage, rows.length)} de ${rows.length} · Página ${page} de ${pageCount}`;

    const previous = document.createElement("button");
    previous.type = "button";
    previous.className = "button button-secondary button-small";
    previous.textContent = "Anterior";
    previous.disabled = page === 1;
    previous.setAttribute("aria-label", "Página anterior");
    previous.addEventListener("click", () => {
      tablePages[bodyId] = page - 1;
      renderPaginatedRows(bodyId, rows);
    });

    const next = document.createElement("button");
    next.type = "button";
    next.className = "button button-secondary button-small";
    next.textContent = "Siguiente";
    next.disabled = page === pageCount;
    next.setAttribute("aria-label", "Página siguiente");
    next.addEventListener("click", () => {
      tablePages[bodyId] = page + 1;
      renderPaginatedRows(bodyId, rows);
    });

    pagination.append(previous, range, next);
  }

  function setTableMessage(bodyId, message) {
    tablePages[bodyId] = 1;
    const body = $(bodyId);
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 8;
    cell.className = "empty-cell";
    cell.textContent = message;
    row.appendChild(cell);
    body.replaceChildren(row);
    const pagination = $(`${bodyId}Pagination`);
    pagination.replaceChildren();
    pagination.classList.add("hidden");
  }

  function renderComparisonChart(values, records, canvasId = "comparisonChart") {
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

    if (charts[canvasId]) charts[canvasId].destroy();
    charts[canvasId] = new Chart($(canvasId), {
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

  function renderErrorChart(records, finalTime, canvasId = "errorChart") {
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
    if (charts[canvasId]) charts[canvasId].destroy();
    charts[canvasId] = new Chart($(canvasId), {
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

  function renderSummaryTable(records, exact, bodyId = "resultsTable") {
    const rows = records.map(record => {
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
      return row;
    });
    renderPaginatedRows(bodyId, rows);
  }

  function renderIterationTable(record, bodyId = "iterationsTable") {
    const rows = record.points.map((point, index) => {
      const row = document.createElement("tr");
      [
        index,
        formatNumber(point.t, 6),
        formatNumber(point.exacta),
        formatNumber(point.aproximacion),
        formatNumber(point.error, 10),
        point.errorRelativoPorcentual === null ? "—" : formatNumber(point.errorRelativoPorcentual, 6)
      ].forEach(value => appendCell(row, String(value)));
      return row;
    });
    renderPaginatedRows(bodyId, rows);
  }

  function renderInterpretation(values, records, exact, ids = {}) {
    const textId = ids.text || "interpretationText";
    const errorId = ids.error || "bestError";
    const methodId = ids.method || "bestMethod";
    const best = records.reduce((current, record) => {
      const error = record.points[record.points.length - 1].error;
      return error < current.error ? { record, error } : current;
    }, { record: records[0], error: records[0].points[records[0].points.length - 1].error });
    const reached = values.Amax === 0 ? 0 : (exact / values.Amax) * 100;
    $(textId).textContent =
      `Con los supuestos ingresados, la solución analítica estima ${formatNumber(exact, 2)} adopciones acumuladas al cabo de ${values.T} meses, aproximadamente ${formatNumber(reached, 2)}% de la meta. ` +
      `${best.record.method} con h=${best.record.h} meses obtuvo el menor error absoluto final (${formatNumber(best.error, 10)} adopciones) en esta comparación. ` +
      `Al reducir h, normalmente mejora la aproximación, aunque aumenta el número de cálculos. Estos resultados describen el modelo, no garantizan el comportamiento real de una campaña.`;
    $(errorId).textContent = formatNumber(best.error, 8);
    $(methodId).textContent = `${best.record.method}, h = ${best.record.h} meses`;
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
    $("historyDetailParameters").textContent =
      `A₀ = ${simulation.adopciones_iniciales} adopciones · Meta = ${simulation.meta_maxima} adopciones · k = ${simulation.tasa_adopcion} mes⁻¹ · Tiempo = ${simulation.tiempo_final} meses`;
    $("historyDetailContent").classList.add("hidden");
    $("historyDetailMessage").textContent = "Cargando resultados guardados...";
    $("historyDetailMessage").className = "form-message";
    $("historyDetailDialog").showModal();
    const { data, error } = await db
      .from("resultados")
      .select("metodo,paso,datos,created_at")
      .eq("simulacion_id", simulation.id)
      .order("paso", { ascending: true });
    if (error) {
      $("historyDetailMessage").textContent = `No se pudieron cargar los resultados: ${error.message}`;
      $("historyDetailMessage").className = "form-message error";
      return;
    }
    const records = data.map(item => {
      const points = item.datos?.puntos;
      if (!Array.isArray(points) || points.length === 0 || !["Heun", "RK4"].includes(item.metodo)) {
        return null;
      }
      return {
        method: item.metodo,
        h: Number(item.paso),
        points: points.map(point => {
          const exacta = Number(point.exacta);
          const aproximacion = Number(point.aproximacion);
          const error = Number.isFinite(Number(point.error))
            ? Number(point.error)
            : Math.abs(exacta - aproximacion);
          const relative = point.errorRelativoPorcentual;
          return {
            t: Number(point.t),
            exacta,
            aproximacion,
            error,
            errorRelativoPorcentual: relative == null
              ? (exacta === 0 ? null : error / Math.abs(exacta) * 100)
              : Number(relative)
          };
        })
      };
    }).filter(record => record && Number.isFinite(record.h) &&
      record.points.every(point =>
        [point.t, point.exacta, point.aproximacion, point.error].every(Number.isFinite) &&
        (point.errorRelativoPorcentual === null || Number.isFinite(point.errorRelativoPorcentual))
      ));

    if (records.length === 0) {
      $("historyDetailMessage").textContent = data.length
        ? "Los resultados guardados no contienen puntos válidos para mostrar."
        : "Esta simulación no tiene resultados guardados.";
      $("historyDetailMessage").className = "form-message";
      return;
    }

    const exact = AdoptaMathMethods.solucionExacta(
      Number(simulation.tiempo_final),
      Number(simulation.adopciones_iniciales),
      Number(simulation.tasa_adopcion),
      Number(simulation.meta_maxima)
    );
    const values = {
      A0: Number(simulation.adopciones_iniciales),
      Amax: Number(simulation.meta_maxima),
      k: Number(simulation.tasa_adopcion),
      T: Number(simulation.tiempo_final)
    };

    $("historyDetailExact").textContent = formatNumber(exact, 6);
    $("historyDetailCalculationTime").textContent = "No registrado";
    $("historyDetailCalculationNote").textContent = "El tiempo no se guardó con esta simulación";
    renderSummaryTable(records, exact, "historyDetailResultsTable");
    renderComparisonChart(values, records, "historyDetailComparisonChart");
    renderErrorChart(records, values.T, "historyDetailErrorChart");
    renderInterpretation(values, records, exact, {
      text: "historyDetailInterpretation",
      error: "historyDetailBestError",
      method: "historyDetailBestMethod"
    });

    const select = $("historyDetailIterationSelect");
    select.replaceChildren();
    records.forEach((record, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${record.method}, h = ${record.h} meses`;
      select.appendChild(option);
    });
    select.onchange = () => renderIterationTable(
      records[Number(select.value)],
      "historyDetailIterationsTable"
    );
    renderIterationTable(records[0], "historyDetailIterationsTable");
    $("historyDetailMessage").textContent =
      `Mostrando ${records.length} conjuntos de resultados guardados.`;
    $("historyDetailMessage").className = "form-message success";
    $("historyDetailContent").classList.remove("hidden");
    requestAnimationFrame(() => {
      charts.historyDetailComparisonChart?.resize();
      charts.historyDetailErrorChart?.resize();
    });
  }

  async function loadHistory() {
    const body = $("historyTable");
    setTableMessage("historyTable", "Cargando historial...");
    $("historyMessage").textContent = "";
    if (!window.db) {
      setTableMessage("historyTable", "Configura Supabase en js/supabase.js.");
      return;
    }
    const { data, error } = await db
      .from("simulaciones")
      .select("id,nombre,adopciones_iniciales,meta_maxima,tasa_adopcion,tiempo_final,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      setTableMessage("historyTable", "No se pudo cargar el historial.");
      $("historyMessage").textContent = error.message;
      $("historyMessage").className = "form-message error";
      return;
    }
    body.replaceChildren();
    if (!data.length) {
      setTableMessage("historyTable", "Todavía no hay simulaciones guardadas.");
      return;
    }
    const rows = data.map(item => {
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
      return row;
    });
    renderPaginatedRows("historyTable", rows);
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
