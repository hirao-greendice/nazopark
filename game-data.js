const GAME_STAGES = [
  {
    id: 1,
    title: "秒感覚",
    prompt: "ストップウォッチで 7.30 秒を狙え",
    type: "stopwatch",
    target: 7.3,
    unit: "s",
    image: "images/q01.png",
    explainImage: "images/q01_explain.png",
    precision: 2
  },
  {
    id: 2,
    title: "直感スライダー",
    prompt: "0〜100 のスライダーを 42 に合わせろ",
    type: "slider",
    min: 0,
    max: 100,
    step: 1,
    target: 42,
    unit: "",
    image: "images/q02.png",
    explainImage: "images/q02_explain.png"
  },
  {
    id: 3,
    title: "角度センス",
    prompt: "スマホを傾けて 35° を狙え",
    type: "gyro",
    target: 35,
    unit: "°",
    precision: 1,
    image: "images/q03.png",
    explainImage: "images/q03_explain.png"
  },
  {
    id: 4,
    title: "方角",
    prompt: "端末を回して 20° を狙え",
    type: "compass",
    target: 20,
    unit: "°",
    wrap: 360,
    precision: 1,
    image: "images/q04.png",
    explainImage: "images/q04_explain.png"
  },
  {
    id: 5,
    title: "円の大きさ",
    prompt: "円の直径を 60 mm に近づけろ",
    type: "circle",
    min: 10,
    max: 120,
    step: 1,
    target: 60,
    unit: "mm",
    image: "images/q05.png",
    explainImage: "images/q05_explain.png"
  },
  {
    id: 6,
    title: "数当て",
    prompt: "0〜500 の数字で 273 を狙え",
    type: "number",
    min: 0,
    max: 500,
    step: 1,
    target: 273,
    unit: "",
    image: "images/q06.png",
    explainImage: "images/q06_explain.png"
  },
  {
    id: 7,
    title: "四択の感覚",
    prompt: "感覚で選べ：10 / 30 / 60 / 90",
    type: "choice",
    options: [10, 30, 60, 90],
    target: 60,
    unit: "",
    image: "images/q07.png",
    explainImage: "images/q07_explain.png"
  },
  {
    id: 8,
    title: "グリッド",
    prompt: "3×3 の中心を当てろ",
    type: "grid",
    target: 5,
    unit: "cell",
    image: "images/q08.png",
    explainImage: "images/q08_explain.png"
  },
  {
    id: 9,
    title: "小数スライダー",
    prompt: "0〜1.00 を 0.37 に合わせろ",
    type: "slider",
    min: 0,
    max: 1,
    step: 0.01,
    target: 0.37,
    unit: "",
    image: "images/q09.png",
    explainImage: "images/q09_explain.png"
  },
  {
    id: 10,
    title: "ミリ秒",
    prompt: "1.23 秒を止めろ",
    type: "stopwatch",
    target: 1.23,
    unit: "s",
    image: "images/q10.png",
    explainImage: "images/q10_explain.png",
    precision: 2
  }
];

function getStageByIndex(index) {
  return GAME_STAGES.find((stage) => stage.id === index);
}
