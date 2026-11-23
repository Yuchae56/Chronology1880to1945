# 같은 폴더의 CSV를 읽어 연표의 data.js를 만든다
import csv
import json
from pathlib import Path
from typing import Dict, List, Tuple, Union

HERE = Path(__file__).parent
CSV_FILES = ["일제강점기-일제강점기.csv", "개항기-개항기.csv"]
DATA_FILE = HERE / "data.js"

# 연표 분류: 이름, 색, 범례 묶음. CSV의 '연표 분류' 칸에는 여기 있는 이름만 쓴다.
CATS = [
    ["조선, 대한제국 정부", "#DB2777", "조선, 대한제국"],
    ["통치 기구, 일본군, 일본인 단체", "#0F172A", "일제"],
    ["일제 법령, 정책", "#1E40AF", "일제"],
    ["친일, 관변 단체", "#64748B", "일제"],
    ["임시정부", "#DC2626", "독립운동"],
    ["독립단체", "#F87171", "독립운동"],
    ["의병, 독립군", "#7F1D1D", "독립운동"],
    ["정당, 정치 세력", "#7C3AED", "정치"],
    ["사회주의, 아나키스트 단체", "#C026D3", "정치"],
    ["사회운동 단체", "#16A34A", "사회·문화·경제"],
    ["교육·학술", "#0D9488", "사회·문화·경제"],
    ["언론·출판", "#0891B2", "사회·문화·경제"],
    ["종교", "#A78BFA", "사회·문화·경제"],
    ["문화·예술", "#65A30D", "사회·문화·경제"],
    ["경제", "#EAB308", "사회·문화·경제"],
    ["운동", "#FB923C", "운동, 사건"],
    ["사건, 전쟁, 집회", "#C2410C", "운동, 사건"],
    ["선언, 문서", "#A16207", "운동, 사건"],
    ["국외 단체·사건·조약", "#38BDF8", "국외"],
]

# '연표 분류' 칸에 이 말을 쓰면 연표에 넣지 않는다 (다른 CSV에 같은 단체가 있을 때)
SKIP = "제외"

# '흐림' 칸: 막대의 어느 쪽을 흐리게 그릴지
FADE = {"": "", "시작": "start", "끝": "end", "양쪽": "both", "이후": "open"}

# '근거 종류' 칸: 설립 연도를 어디서 가져왔는지. 빈칸은 책의 표에 적힌 연도
KIND = {"": 0, "책 비고": 1, "백과사전": 2, "알려주신 정보": 3, "웹 자료": 4, "한국사 데이터베이스": 5, "실록": 6}

Row = Dict[str, str]
Item = List[Union[int, str]]


def read_rows(path: Path) -> List[Row]:
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def find_cat(row: Row) -> int:
    name = row["연표 분류"]
    for index, cat in enumerate(CATS):
        if cat[0] == name:
            return index
    raise ValueError(f"{row['이름']}: 연표 분류 '{name}'이(가) make_data.py의 CATS에 없습니다")


def read_number(row: Row, column: str) -> int:
    text = row[column]
    if text == "":
        return 0
    if not text.isdigit():
        raise ValueError(f"{row['이름']}: '{column}' 칸의 '{text}'은(는) 숫자가 아닙니다")
    return int(text)


def read_month(row: Row, column: str) -> int:
    month = read_number(row, column)
    if month > 12:
        raise ValueError(f"{row['이름']}: '{column}' 칸의 {month}은(는) 1~12가 아닙니다")
    return month


def read_start(row: Row) -> Tuple[int, str]:
    text = row["설립 연도"]
    if text.isdigit():
        return int(text), ""

    parts = text.split(" / ")
    if len(parts) == 2:
        if parts[0].isdigit() and parts[1].isdigit():
            return int(parts[0]), parts[0] + "/" + parts[1]

    first = text[:4]
    if first.isdigit() and row["기간 표기"] != "":
        return int(first), ""

    raise ValueError(
        f"{row['이름']}: 설립 연도 '{text}'을(를) 읽을 수 없습니다. "
        "'1906'이나 '1930 / 1931'로 쓰거나, '기간 표기' 칸을 채워 주세요"
    )


def make_item(row: Row) -> Item:
    year, year_label = read_start(row)

    fade = row["흐림"]
    if fade not in FADE:
        raise ValueError(f"{row['이름']}: 흐림 칸의 '{fade}'은(는) {list(FADE)} 중 하나가 아닙니다")

    kind = row["근거 종류"]
    if kind not in KIND:
        raise ValueError(f"{row['이름']}: 근거 종류 칸의 '{kind}'은(는) {list(KIND)} 중 하나가 아닙니다")

    return [
        find_cat(row),
        row["이름"],
        year,
        read_month(row, "월"),
        read_number(row, "끝 연도"),
        read_month(row, "끝 월"),
        FADE[fade],
        year_label,
        row["기간 표기"],
        row["근거 메모"],
        KIND[kind],
        row["링크"],
        row["색인 이름"],
    ]


def to_js(value: list) -> str:
    return json.dumps(value, ensure_ascii=False)


def write_data(items: List[Item], unplaced: List[Item], start: int) -> None:
    lines = ["// make_data.py가 CSV로 만드는 파일이다. 여기를 고치지 말고 CSV를 고친 뒤 다시 만든다."]
    lines.append(f"const START = {start};")

    lines.append("const CATS = [")
    for cat in CATS:
        lines.append("  " + to_js(cat) + ",")
    lines.append("];")

    lines.append("// prettier-ignore")
    lines.append("const ITEMS = [")
    for item in items:
        lines.append("  " + to_js(item) + ",")
    lines.append("];")

    lines.append("const UNPLACED = [")
    for item in unplaced:
        lines.append("  " + to_js(item) + ",")
    lines.append("];")

    DATA_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    items: List[Item] = []
    unplaced: List[Item] = []
    for file_name in CSV_FILES:
        for row in read_rows(HERE / file_name):
            if row["이름"] == "":
                continue
            if row["연표 분류"] == SKIP:
                continue
            if row["설립 연도"] == "":
                unplaced.append([find_cat(row), row["이름"]])
                continue
            items.append(make_item(row))

    start = min(int(item[2]) for item in items)
    write_data(items, unplaced, start)
    print(f"[연표] 항목 {len(items)}개, 연도를 모르는 항목 {len(unplaced)}개, {start}년부터")


main()
