const { save, message } = window.__TAURI__.dialog;
const { invoke } = window.__TAURI__.core;


(async () => {
    // Handsontable 초기화
    const handsontable = {
        rootElementId: 'data-grid',
        async init() {
            // Handsontable 초기화
            this.hot = new Handsontable(document.getElementById(this.rootElementId), {
                ...(await this.getSchema()),
                ...(await this.getCallbackEvents()),
            });
            this.initInteractive();
        },
        async getSchema() {
            return await (await fetch("/handsontables.schema.json")).json()
        },
        async getCallbackEvents() {
            return {
                cells: (rowIndex, colIndex) => { },              // 셀 렌더링 이벤트
                beforeRowMove: (rows, target) => true,          // 행 이동 전 이벤트
                afterRowMove: (rows, target) => true,           // 행 이동 후 이벤트
                afterChange: (changes, source) => true,         // 셀 변경 후 이벤트
                beforeChange: (changes) => true,                // 셀 변경 전 이벤트
                afterRenderer: (td, row, col, prop, value, cellProperties) => {
                    const hot = this.hot;
                    if (typeof value === 'boolean') {           // 체크박스 셀 렌더링
                        td.innerHTML = `<label class="handsontable-checkbox"> <input type="checkbox" class="filled-in" ${value ? 'checked' : ''}> <span></span></label>`;
                        const checkbox = td.querySelector('input[type="checkbox"]');
                        checkbox.addEventListener('change', (event) => {
                            const newValue = event.target.checked;
                            hot.setDataAtCell(row, col, newValue); // 데이터 업데이트
                        });
                    }
                }
            }
        },
        async initInteractive() {
            const handleClickEvent = (event) => {
                const { target } = event;
                if (target.dataset.handsontableTrigger && this[target.dataset.handsontableTrigger]) {
                    this[target.dataset.handsontableTrigger]();
                }
            }
            document.removeEventListener('click', handleClickEvent);
            document.addEventListener('click', handleClickEvent);
        },
        addRow() {
            const hot = this.hot;
            const rowCount = hot.countRows();          // 현재 행 수 가져오기
            hot.alter('insert_row_below', rowCount);   // 새 행 추가
            this.newEmptyCells(rowCount);                // 새 행에 빈 값 추가
        },
        newEmptyCells(rowIndex) {
            const hot = this.hot;
            [
                false, null,
                null, "linear", "show", 5, "show",
                null, "linear", "show", 5, "show",
                null, "linear", "show", 5, "show"
            ]
                .forEach((value, colIndex) => hot.setSourceDataAtCell(rowIndex, colIndex, value));
            hot.render();
        },
        deleteSelectedRows() {
            const hot = this.hot;
            hot.getData().map((row, index) => ({ row, index }))
                .filter(o => o.row[0])
                .reverse()
                .forEach(o => hot.alter('remove_row', o.index))
        },
        getData() {
            const hot = this.hot;
            return {
                version: '1.0',
                date: new Date().toISOString(),
                common: {
                    title: document.querySelector("#title").value,
                    yMinorSplit: document.querySelector("#yAxisMajorSplit").checked,
                },
                series: [
                    {
                        index: 0,
                        use: document.querySelector("#y1Axis").checked,
                        unitName: document.querySelector("#y1UnitName").value,
                        unitMark: document.querySelector("#y1UnitMark").value,
                        color: document.querySelector("#y1UnitColor").value,
                    },
                    {
                        index: 1,
                        use: document.querySelector("#y2Axis").checked,
                        unitName: document.querySelector("#y2UnitName").value,
                        unitMark: document.querySelector("#y2UnitMark").value,
                        color: document.querySelector("#y2UnitColor").value,
                    },
                    {
                        index: 2,
                        use: document.querySelector("#y3Axis").checked,
                        unitName: document.querySelector("#y3UnitName").value,
                        unitMark: document.querySelector("#y3UnitMark").value,
                        color: document.querySelector("#y3UnitColor").value,
                    }
                ],
                data: hot.getData(),
            }
        },
        setData(data) {
            console.log('setData', data);
            document.querySelector("#title").value = data.common.title;
            document.querySelector("#yAxisMajorSplit").checked = data.common.yMinorSplit;

            document.querySelector("#y1Axis").checked = data.series[0].use;
            document.querySelector("#y1UnitName").value = data.series[0].unitName;
            document.querySelector("#y1UnitMark").value = data.series[0].unitMark;
            document.querySelector("#y1UnitColor").value = data.series[0].color;

            document.querySelector("#y2Axis").checked = data.series[1].use;
            document.querySelector("#y2UnitName").value = data.series[1].unitName;
            document.querySelector("#y2UnitMark").value = data.series[1].unitMark;
            document.querySelector("#y2UnitColor").value = data.series[1].color;

            document.querySelector("#y3Axis").checked = data.series[2].use;
            document.querySelector("#y3UnitName").value = data.series[2].unitName;
            document.querySelector("#y3UnitMark").value = data.series[2].unitMark;
            document.querySelector("#y3UnitColor").value = data.series[2].color;

            this.hot.loadData(data.data);
        },
        openFile() {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.sc';
            fileInput.addEventListener('change', async (event) => {
                const file = event.target.files[0];
                if (file) {
                    const data = JSON.parse(await file.text());
                    this.setData(data);
                }
            });
            fileInput.click();
        },
        async saveFile() {
            try {
                const savePath = await save({
                    defaultPath: 'chart.sc',
                    filters: [
                        {
                            name: 'chart',
                            extensions: ['sc'],
                        },
                    ],
                });

                if (!savePath) return;

                await invoke("save_file", {
                    path: savePath,
                    contents: JSON.stringify(this.getData()),
                });
            } catch (e) {
                console.log(e);
                message('파일 저장 중 오류가 발생했습니다.', { title: 'Error', kind: 'error' });
            }
        }
    }


    // Apache ECharts 초기화
    const apacheCharts = {
        rootElementId: 'chart',
        width: 700,
        height: 400,
        async init() {
            this.chart = echarts.init(
                document.getElementById('chart'),
                null,
                { width: this.width, height: this.height }
            );
            this.playInitGraph();
            this.initInteractive();
        },

        async playInitGraph() {
            this.playLoaddingGraph();
            this.playInitTimeoutEventCode = setTimeout(async () => this.updateUI((await (await fetch("/charts.init.schema.json")).json())), 1500);
        },
        async playLoaddingGraph() {
            this.updateUI({
                graphic: {
                    elements: [
                        {
                            type: 'group',
                            left: 'center',
                            top: 'center',
                            children: new Array(7).fill(0).map((val, i) => ({
                                type: 'rect',
                                x: i * 20,
                                shape: {
                                    x: 0,
                                    y: -40,
                                    width: 10,
                                    height: 80
                                },
                                style: {
                                    fill: '#5470c6'
                                },
                                keyframeAnimation: {
                                    duration: 1000,
                                    delay: i * 200,
                                    loop: true,
                                    keyframes: [
                                        {
                                            percent: 0.5,
                                            scaleY: 0.3,
                                            easing: 'cubicIn'
                                        },
                                        {
                                            percent: 1,
                                            scaleY: 1,
                                            easing: 'cubicOut'
                                        }
                                    ]
                                }
                            }))
                        }
                    ]
                }
            });
        },
        async updateUI(option = {}) {
            if (this.playInitTimeoutEventCode) {
                clearTimeout(this.playInitTimeoutEventCode);
                this.playInitTimeoutEventCode = null;
            }
            const chart = this.chart;
            chart.clear();
            chart.setOption(option);
        },
        async initInteractive() {
            const handleClickEvent = (event) => {
                const { target } = event;
                if (target.dataset.chartsTrigger && this[target.dataset.chartsTrigger]) {
                    this[target.dataset.chartsTrigger]();
                }
            }
            document.removeEventListener('click', handleClickEvent);
            document.addEventListener('click', handleClickEvent);
        },
        async updateChart() {
            try {
                const data = handsontable.getData();
                const seriesYAxis = data.series.filter(s => s.use).map((s, i) => ({ ...s, index: i }));
                const GROUP_SIZE = 6;
                const schema = {
                    title: this.schema.getTitle(data.common.title),
                    color: this.schema.getColor(seriesYAxis.map(s => s.color)),
                    legend: this.schema.getLegend(seriesYAxis.map(s => s.unitName)),
                    toolbox: this.schema.getToolbox(),
                    tooltip: this.schema.getTooltip(),
                    grid: this.schema.getGrid(),
                    xAxis: this.schema.getXAxis(data.data.map(d => d[1])),
                    yAxis: seriesYAxis.map(s => this.schema.getYAxis(data.common, s, { total: seriesYAxis.length })),
                    series: seriesYAxis.map(s => this.schema.getSeries(s,
                        data.data.map(d => d.slice((s.index * GROUP_SIZE) + 2, ((s.index * GROUP_SIZE) + 2) + GROUP_SIZE)))
                    ).flat()
                };
                console.log('schema', schema)
                this.updateUI(schema);
            } catch (e) {
                console.error(e);
                message('차트 업데이트 중 오류가 발생했습니다.', { title: 'Error', kind: 'error' });
            }
        },

        schema: {
            getTitle(text = '') {
                return { text }
            },
            getColor(color = []) {
                return color
            },
            getLegend(data = []) {
                return { data }
            },
            getToolbox() {
                return {
                    feature: {
                        dataView: { show: false, readOnly: false },
                        restore: { show: false },
                        saveAsImage: { show: false }
                    }
                }
            },
            getTooltip() {
                return {
                    trigger: "axis",
                    axisPointer: { type: "cross" },
                    formatter(params) { return ``; }
                }
            },
            getGrid() {
                return [{ show: true, containLabel: true }]
            },
            getXAxis(data = []) {
                return {
                    data,
                    type: 'category',
                    boundaryGap: false,
                    axisLabel: {
                        show: true,
                        align: 'center',
                        formatter(value) { return value === 'null' ? '' : value; }
                    },
                    axisTick: {
                        show: true,
                        length: 0,
                        lineStyle: { color: '#000' },
                    },
                    splitLine: {
                        show: true,
                        interval(index, value) { return !(value === '' || value === 'null'); },
                        lineStyle: {
                            color: '#ddd',
                            type: 'solid'
                        }
                    },
                }
            },
            getYAxis(common = {}, series = {}, { total = 0 }) {
                return {
                    type: 'value',
                    name: '',
                    alignTicks: true,
                    offset: Math.max(0, (series.index - 1) * 50),
                    position: series.index === 0 ? 'left' : 'right',
                    axisLabel: { formatter: '{value}' },
                    axisLine: {
                        show: total > 1,
                        lineStyle: { color: series.color }
                    },
                    minorSplitLine: { show: common.yMinorSplit }
                }
            },
            getSeries(series = {}, data = []) {
                const dataList = data.map(d => d[0]);
                const stepList = data.map(d => d[1]);
                const symbolList = data.map(d => d[2]);
                const sbSizeList = data.map(d => d[3]);
                const labelList = data.map(d => d[4]);
                const labelPosList = data.map(d => d[5]);

                return [
                    ...this.groupOverlappingPairs(dataList)
                        .map(([start, end], i) => this.createSeriesData({
                            index: series.index,
                            unitName: series.unitName,
                            unitMark: series.unitMark,
                            color: series.color,
                            data: this.createArraySetRangeValue(dataList.length, i, start, end),
                            step: this.formatStepValue(stepList[i]),
                            symbol: false,
                            sbSize: 0,
                            label: false,
                            labelPos: labelPosList[i]
                        })),
                    ...dataList.map((data, i) => this.createSeriesData({
                        index: series.index,
                        unitName: series.unitName,
                        unitMark: series.unitMark,
                        color: series.color,
                        data: this.createArraySetValue(dataList.length, i, data),
                        step: this.formatStepValue(stepList[i]),
                        symbol: this.showOrHide(symbolList[i]),
                        sbSize: sbSizeList[i],
                        label: this.showOrHide(labelList[i]),
                        labelPos: labelPosList[i]
                    }))
                ]
            },
            createSeriesData({ index, unitName, unitMark, color, data, step, symbol, sbSize, label, labelPos }) {
                return {
                    data,
                    step,
                    type: 'line',
                    name: `${unitName}`,
                    connectNulls: true,
                    showSymbol: symbol,
                    yAxisIndex: index,
                    lineStyle: { color },
                    itemStyle: { color },
                    symbolSize: [sbSize, sbSize],
                    label: {
                        show: label,
                        position: labelPos,
                        formatter(params) { return `${params.value}${unitMark}` }
                    },
                }
            },
            groupOverlappingPairs(arr) {
                return arr.map((_, i) => i < arr.length - 1 ? [arr[i], arr[i + 1]] : null).filter(Boolean);
            },
            formatStepValue(step) {
                return 'linear' === step ? false
                    : step === 'step-up' ? 'start'
                        : step === 'step-middle' ? 'middle' : 'end';
            },
            createArraySetRangeValue(length, index, val1, val2) {
                const arr = new Array(length).fill(null);
                if (index < length - 1) {
                    arr[index] = val1;
                    arr[index + 1] = val2;
                }
                return arr;
            },
            createArraySetValue(length, index, val) {
                const arr = new Array(length).fill(null);
                if (index < length) {
                    arr[index] = val;
                }
                return arr;
            },
            showOrHide(value) {
                return value === 'show';
            },
        },
        async downloadChart() {
            const savePath = await save({
                defaultPath: 'chart.png',
                filters: [
                    {
                        name: 'chart',
                        extensions: ['png'],
                    },
                ],
            });

            if (!savePath) return;


            const dataURL = this.chart.getDataURL({ pixelRatio: 2, backgroundColor: '#fff' });
            const base64Data = dataURL.split(',')[1];
            const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

            if (savePath) {
                await invoke('save_image', { path: savePath, contents: Array.from(binaryData) });
            }

        }
    }

    handsontable.init();
    apacheCharts.init();

    return {
        handsontable,
        apacheCharts,
    }

})();
