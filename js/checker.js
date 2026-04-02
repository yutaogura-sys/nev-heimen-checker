/* ============================================================
   checker.js — Gemini API を使った平面図の要件チェック
   NeV補助金（次世代自動車充電インフラ整備促進事業）5-9-2 平面図
   正解事例 30件以上の分析に基づく高精度チェックロジック
   ============================================================ */

const DrawingChecker = (() => {

  // ─── チェック項目定義 ───────────────────────────
  // 共通チェック項目（基礎・目的地の両方に適用）
  const COMMON_CHECKS = [
    // ── 表題欄 ──
    {
      id: 'setting_place',
      category: 'title_block',
      label: '設置場所名称の記載',
      description: '表題欄の「設置場所」欄に、申請で入力した設置場所名称（略称不可）が記載されているか。例）○○マンション、○○ホテル 等',
      required: true,
    },
    {
      id: 'drawing_name',
      category: 'title_block',
      label: '図面名称「平面図」の記載',
      description: '表題欄の「図面名称」欄に正確に「平面図」と記載されているか。「新設 平面図」「既設 平面図」も可。不備例：平面配置図、配置図、レイアウト図等は不可',
      required: true,
    },
    {
      id: 'project_name',
      category: 'title_block',
      label: '工事名の記載',
      description: '表題欄に工事名が記載されているか。正解例：「普通充電設備設置工事」「充電設備設置工事」等',
      required: true,
    },
    {
      id: 'creator',
      category: 'title_block',
      label: '作成者の記載',
      description: '表題欄の「作成者」欄に会社名または個人名が記載されているか',
      required: true,
    },
    {
      id: 'scale',
      category: 'title_block',
      label: '縮尺の記載',
      description: '表題欄の「縮尺」欄に縮尺が記載されているか。正解例：A3:1/100、1/150 等。サイズ指定なし。不明の場合は「-」も可',
      required: true,
    },
    {
      id: 'creation_date',
      category: 'title_block',
      label: '作成日の記載',
      description: '表題欄の「作成日」欄に日付が記載されているか（YYYY年MM月DD日 形式等）',
      required: true,
    },

    // ── 充電スペース ──
    {
      id: 'space_labels',
      category: 'charging_space',
      label: '充電スペースの番号ラベル',
      description: '充電スペースに通し番号付きラベルが記載されているか。正解例：【充電スペース1】【充電スペース2】…、充電スペース×4 等',
      required: true,
    },
    {
      id: 'space_dimensions',
      category: 'charging_space',
      label: '充電スペースの寸法（幅×奥行）',
      description: '各充電スペースの幅と奥行きの寸法が記載されているか。正解例：幅2.5m × 奥行5.0m、幅2500 × 奥行4900 等',
      required: true,
    },
    {
      id: 'space_width_check',
      category: 'charging_space',
      label: '充電スペース幅 2.5m（2500mm）以上',
      description: '全ての充電スペースの幅が2.5m（2500mm）以上あるか。2.5m未満は不備',
      required: true,
    },
    {
      id: 'space_highlight',
      category: 'charging_space',
      label: '充電スペースの着色・ハッチング表示',
      description: '充電スペースが赤色・ピンク色等のハッチング（斜線）や着色で視覚的に明示されているか',
      required: true,
    },

    // ── EV充電設備 ──
    {
      id: 'equipment_labels',
      category: 'ev_equipment',
      label: 'EV充電設備の通し番号ラベル',
      description: 'EV充電設備に通し番号付きラベルが記載されているか。正解例：EV充電設備1、EV充電設備2,3、EV充電設備1〜4 等',
      required: true,
    },
    {
      id: 'mounting_method',
      category: 'ev_equipment',
      label: '設置方法の記載',
      description: 'EV充電設備の設置方法が記載されているか。正解例：壁面設置、金属架台、置き基礎、コンクリート置き基礎 等',
      required: true,
    },
    {
      id: 'foundation_spec',
      category: 'ev_equipment',
      label: '基礎仕様・寸法の記載',
      description: '基礎の仕様と寸法が記載されているか。正解例：コンクリート 500×500×120H、コンクリート置き基礎 500×500×500H 等。壁面設置の場合は壁面からの距離(例:280mm)でも可',
      required: true,
    },

    // ── 路面・寸法 ──
    {
      id: 'surface_material',
      category: 'surface_dimensions',
      label: '路面状況（材質）の記載',
      description: '路面を構成する材質が記載されているか。正解例：路面状況：アスファルト、路面状況：土、路面状況：コンクリート 等',
      required: true,
    },
    {
      id: 'dimension_lines',
      category: 'surface_dimensions',
      label: '寸法線の記載',
      description: '充電設備・充電スペース周辺に寸法線（mm単位）が記載されているか。正解例：2500, 4900, 820, 1590 等の寸法線',
      required: true,
    },
    {
      id: 'compass',
      category: 'surface_dimensions',
      label: '方位記号（N）の記載',
      description: '方位記号（北を示すN矢印）が図面上に記載されているか。通常は右上に配置',
      required: true,
    },
  ];

  // 基礎充電（マンション・集合住宅）固有チェック項目
  const KISO_CHECKS = [
    {
      id: 'surrounding_structures',
      category: 'kiso_specific',
      label: '周辺構造物の記載',
      description: '建物、駐車場、駐輪場、フェンス、縁石、道路、隣地、植栽等の周辺構造物が記載されているか',
      required: true,
    },
    {
      id: 'building_name',
      category: 'kiso_specific',
      label: '建物名称の表示',
      description: 'マンション・団地等の建物名称が図面上に表示されているか',
      required: true,
    },
    {
      id: 'equipment_space_consistency',
      category: 'kiso_specific',
      label: 'EV充電設備数と充電スペース数の整合性',
      description: 'EV充電設備の台数と充電スペースの数が対応しているか（1設備に1スペース、またはペア設備に対応するスペース数）',
      required: true,
    },
    {
      id: 'existing_equipment_kiso',
      category: 'kiso_specific',
      label: '既設充電設備の表示',
      description: '既設充電設備がある場合、既設と新設が区別して表示されているか（該当する場合のみ）',
      required: false,
    },
  ];

  // 目的地充電（商業施設等）固有チェック項目
  const MOKUTEKICHI_CHECKS = [
    {
      id: 'ground_marking',
      category: 'mokutekichi_specific',
      label: '路面表示の記載',
      description: '路面表示（EV充電スペースを示すステッカー等）の記載があるか。正解例：路面表示 新設 900×900、路面シート 等',
      required: true,
    },
    {
      id: 'ground_marking_spec',
      category: 'mokutekichi_specific',
      label: '路面表示の仕様（新設/既設・サイズ）',
      description: '路面表示が新設か既設か、およびサイズが記載されているか。正解例：新設 900×900、既設路面表示 残置、既設路面シート 残置 等',
      required: true,
    },
    {
      id: 'ground_marking_surface',
      category: 'mokutekichi_specific',
      label: '路面表示のアスファルト面設置',
      description: '路面表示がアスファルト面に設置されることが確認できるか（路面状況がアスファルトと記載されているか）',
      required: true,
    },
    {
      id: 'existing_equipment',
      category: 'mokutekichi_specific',
      label: '既設充電設備の表示（該当する場合）',
      description: '既設充電設備がある場合、既設EV充電設備と既設充電スペースが青色等で区別して表示されているか',
      required: false,
    },
    {
      id: 'new_existing_distinction',
      category: 'mokutekichi_specific',
      label: '新設/既設の色分け・ページ分離',
      description: '新設と既設が色分け（新設=赤/ピンク、既設=青）またはページ分離（新設 平面図/既設 平面図）で区別されているか。既設がない場合はパスとする',
      required: false,
    },
    {
      id: 'subsidy_exclusion',
      category: 'mokutekichi_specific',
      label: '補助金対象外設備の明記（該当する場合）',
      description: '補助金対象外の設備がある場合、「※補助金対象外※」等の表記で明示されているか',
      required: false,
    },
  ];

  // カテゴリ定義
  const CATEGORIES = {
    title_block:           { title: '①表題欄（図面基本情報）',      icon: '&#128203;', order: 1 },
    charging_space:        { title: '②充電スペース',               icon: '&#128199;', order: 2 },
    ev_equipment:          { title: '③EV充電設備',                icon: '&#128268;', order: 3 },
    surface_dimensions:    { title: '④路面状況・寸法・方位',        icon: '&#128207;', order: 4 },
    kiso_specific:         { title: '⑤基礎充電 固有項目',          icon: '&#127970;', order: 5 },
    mokutekichi_specific:  { title: '⑤目的地充電 固有項目',        icon: '&#127978;', order: 5 },
  };

  // ─── Gemini プロンプト生成 ──────────────────────
  function buildPrompt(type) {
    const checks = type === 'kiso'
      ? [...COMMON_CHECKS, ...KISO_CHECKS]
      : [...COMMON_CHECKS, ...MOKUTEKICHI_CHECKS];

    const checkListText = checks.map((c, i) => {
      return `${i + 1}. [${c.id}] ${c.label}\n   確認内容: ${c.description}\n   必須: ${c.required ? 'はい' : 'いいえ（該当する場合のみ）'}`;
    }).join('\n\n');

    const typeLabel = type === 'kiso'
      ? '基礎充電（マンション・集合住宅向け）'
      : '目的地充電（商業施設・ホテル・ゴルフ場等向け）';

    return `あなたはNeV補助金（次世代自動車充電インフラ整備促進事業）の「平面図」の審査エキスパートです。
補助金要件 5-9-2「平面図」に基づき、アップロードされた図面PDFを非常に高い精度で分析してください。
これはEV充電設備の補助金申請における平面図（設備配置・充電スペース寸法等を示す技術図面）です。

## 重要：平面図とは
平面図は、EV充電設備の設置場所を上から見た詳細な技術図面です。
設置場所見取図（敷地全体・公道・入口を示す広域図）とは異なり、
充電設備の配置位置、充電スペースの正確な寸法、基礎仕様、路面状況等を詳細に示します。

## 図面タイプ
${typeLabel}

## 補助金要件（5-9-2 平面図）

### 基本要件
平面図には以下の内容を審査で確認できるように記載する必要があります：
- 路面を構成する材質（アスファルト、コンクリート、土、砂利、草等）
- 充電スペースの配置（充電スペースの幅と奥行きの寸法を含む）
- EV充電設備の配置位置と台数
- 設備の設置方法（基礎形状・寸法を含む）
- 寸法線

### (1) 表題欄（図面右下または下部の枠）
以下の項目が表題欄に記載されている必要があります：
- **設置場所**: 申請で入力した設置場所名称（略称不可）
- **図面名称**: 「平面図」と正確に記載（「新設 平面図」「既設 平面図」も可）
  - 不備事例：「平面配置図」「配置図」「レイアウト図」等は不可
- **工事名**: 「普通充電設備設置工事」「充電設備設置工事」等
- **作成者**: 会社名または個人名
- **縮尺**: 数値（例: A3:1/100、1/150 等）。不明の場合は「-」
- **作成日**: 年月日の記載

### (2) 充電スペース
- 充電スペースの位置を図示し、通し番号ラベルを付ける
- **幅と奥行きの寸法を必ず記載**（例: 幅2.5m × 奥行5.0m）
- 充電スペースの**幅は2.5m（2500mm）以上**であること
  - 不備事例：幅が2500mm(2.5m)未満
- 赤色・ピンク色のハッチング（斜線）等で視覚的に明示

### (3) EV充電設備
- EV充電設備に通し番号ラベルを付ける（EV充電設備1, 2...）
- 設置方法を記載（壁面設置/金属架台/置き基礎/コンクリート置き基礎 等）
- 基礎の寸法を記載（例: コンクリート 500×500×120H）

### (4) 路面状況・寸法
- 路面を構成する材質を記載（例: 路面状況：アスファルト、路面状況：土）
- 寸法線をmm単位で記載
- 方位記号（N）を記載

${type === 'mokutekichi' ? `### (5) 路面表示（目的地充電 必須）
- 路面表示（EVスペースを示すステッカー）の記載
- 新設/既設の区別を記載（例: 路面表示 新設 900×900、既設路面表示 残置）
- アスファルト面に設置されること

### (6) 既設設備の区別（該当する場合）
- 既設充電設備がある場合、新設と既設を色分け等で区別
  - 新設: 赤色/ピンク色
  - 既設: 青色
- ページ分離する場合: 「新設 平面図」と「既設 平面図」
- 既設設備には「残置」の文字を記載
- 補助金対象外設備がある場合は「※補助金対象外※」と明記
` : `### (5) 基礎充電固有の確認事項
- 周辺構造物（建物、駐車場、駐輪場、フェンス、縁石、道路、隣地、植栽等）の記載
- 建物名称の表示
- EV充電設備数と充電スペース数の整合性
`}

## 正解事例から学んだパターン（30件以上の分析結果）

### 表題欄の標準パターン（図面右下の枠内）
- **設置場所**: 施設名のみ記載（例: 「ホテルニューミフク」「リリーヴィレッジＣＲＥＳＴ」）
- **図面名称**: 「平面図」（複数ページの場合は「新設 平面図」「既設 平面図」）
- **工事名**: 「普通充電設備設置工事」が最も多い
- **作成者**: 会社ロゴ＋会社名（例: 「ENECHANGE EVラボ株式会社」）
- **縮尺**: 「A3:1/100」が最も一般的
- **作成日**: YYYY年MM月DD日 形式

### 充電スペースの標準パターン
- ラベル形式: **【充電スペース1】【充電スペース2】…**（墨付き括弧で番号表記）
- 寸法表記: **幅2.5m × 奥行5.0m**（m単位）または **幅2500 × 奥行4900**（mm単位）
- 最小幅: 2.5m（2500mm）、実例では2.5m〜2.7m
- 奥行: 4.5m〜5.5mが一般的
- 色: **赤色/ピンク色のハッチング（斜線エリア）**で明示
- 充電スペース数は図面上に「充電スペース×N」の形で記載されることもある

### EV充電設備の標準パターン
- ラベル形式: **EV充電設備1**、**EV充電設備2,3**（ペアの場合はカンマ区切り）
- 設置方法（以下のいずれか）:
  - **壁面設置**: 壁から280mm等の距離を記載
  - **金属架台**: コンクリート基礎の上に金属架台を設置
  - **置き基礎/コンクリート置き基礎**: 地面にコンクリートブロックを置く
- 基礎寸法の例:
  - コンクリート 500×500×120H（最も一般的）
  - コンクリート 500×500×500H
  - コンクリート置き基礎 500×500×120H
- 緑色のテキストでラベル・詳細が記載されることが多い

### 路面・寸法の標準パターン
- 路面状況: 「路面状況：アスファルト」「路面状況：土」等のラベル
- 寸法線: mm単位の標準的な建築図面の寸法線（矢印付き）
  - 例: 820, 1590, 900, 2500, 4900 等
- 方位記号: 図面右上に北（N）を示す矢印

${type === 'mokutekichi' ? `### 目的地充電の正解パターン
- **路面表示**: 「路面表示 新設 900×900」がアスファルト上に記載
  - 既設の場合: 「既設路面表示 残置」「既設路面シート 残置」
- **色分け**:
  - 新設設備・スペース: **赤色/ピンク色**
  - 既設設備・スペース: **青色**
- **ページ構成**:
  - 新設のみの場合: 1ページ（「平面図」）
  - 新設＋既設の場合: 2ページ（「新設 平面図」＋「既設 平面図」）
- **既設表記**: 「既設EV充電設備1,2 残置」「既設充電スペース×2 残置」
- **補助金対象外**: 「※補助金対象外※」マークで明示
` : `### 基礎充電の正解パターン
- **建物名称**: 図面上に大きくマンション・団地名が表示
- **周辺構造物**: 建物、駐輪場、フェンス、縁石、道路、隣地、植栽等を詳細に描画
- **路面表示は不要**（目的地充電と異なる重要なポイント）
- **ページ構成**: 基本的に1ページ
- **充電設備数**: 2〜7基の範囲が一般的
- 立体駐車場の場合は階数表記あり
`}

### A3用紙の標準レイアウト
- 用紙サイズ: A3横（約420mm × 297mm）
- 表題欄: 図面右下に配置
- 方位記号: 図面右上に配置
- 図面本体: 中央〜左側に配置

## チェック項目
${checkListText}

## 回答フォーマット（厳密にこのJSON形式で返してください）
以下のJSON形式のみで回答してください。JSONの前後に余計なテキストは不要です。

\`\`\`json
{
  "results": [
    {
      "id": "チェック項目ID",
      "status": "pass | fail | warn",
      "found_text": "図面から実際に読み取れた内容（なるべく具体的に。読み取れたテキスト・数値をそのまま記載）",
      "detail": "判定理由の詳細説明"
    }
  ],
  "overall_comment": "図面全体に対する総合コメント（良い点・改善が必要な点を含む。400文字程度で具体的に）",
  "detected_info": {
    "facility_name": "読み取れた施設名",
    "drawing_title": "読み取れた図面名称",
    "project_name": "読み取れた工事名",
    "creator": "読み取れた作成者名",
    "scale": "読み取れた縮尺",
    "creation_date": "読み取れた作成日",
    "surface_material": "読み取れた路面状況",
    "equipment_count": "読み取れたEV充電設備の台数",
    "equipment_details": "各設備の設置方法・基礎仕様の一覧",
    "space_count": "読み取れた充電スペースの数",
    "space_dimensions_list": "各スペースの幅×奥行の一覧",
    "ground_marking_info": "読み取れた路面表示情報（目的地のみ、なければ空文字）",
    "existing_equipment_info": "読み取れた既設設備情報（なければ空文字）",
    "page_count_analyzed": "解析したページ数"
  }
}
\`\`\`

## 判定基準
- **pass**: 要件を満たしている（明確に記載が確認できる）
- **fail**: 要件を満たしていない（記載が見当たらない、または明らかに不十分）
- **warn**: 記載はあるが不明瞭、または要件を部分的にしか満たしていない

## 判定の注意事項（精度向上のために必ず守ること）

### 全体的な確認方法
- 画像を非常に注意深く、隅々まで確認してください
- **拡大して細部まで読み取る**つもりで、小さな文字やラベルも見逃さないでください
- 複数ページがある場合は全ページを確認してください

### 表題欄の確認方法
- **図面の右下または下部**にある枠線で囲まれた領域を重点的に確認
- 枠内に「設置場所」「図面名称」「作成者」「縮尺」「作成日」等のラベルがあるはずです
- 「設置場所」と「工事名」は別の欄の場合があります（「設置場所:○○」＋「○○充電設備設置工事」）
- 「図面名称」が「平面図」であることを厳密に確認（「設置場所見取図」「配線ルート図」等は不可）

### 充電スペースの確認方法
- **赤色/ピンク色のハッチング（斜線エリア）**が充電スペースの指標です
- 【】で囲まれた番号ラベルを探してください（例:【充電スペース1】）
- 寸法は「幅○m × 奥行○m」「幅○○○○ × 奥行○○○○」の形式で記載されています
- **幅が2500mm(2.5m)以上**であることを具体的な数値で確認してください

### EV充電設備の確認方法
- 「EV充電設備」のテキストラベルを探してください
- 設備の近くに設置方法（壁面設置/金属架台/置き基礎等）と基礎寸法の注記があるはずです
- 緑色のテキストで記載されていることが多いです

### 路面・寸法の確認方法
- 「路面状況：○○」のテキストを探してください
- mm単位の寸法線（矢印付きの線）が充電スペース周辺にあるか確認
- 方位記号（N矢印）は通常、図面右上にあります

${type === 'mokutekichi' ? `### 目的地充電の追加確認
- 「路面表示」のテキストを探してください（「路面表示 新設 900×900」等）
- 「路面表示」は充電スペースの近くにアスファルト上に設置される旨の記載
- 既設設備がある場合は**青色の領域**を確認してください
- 「残置」「既設」のテキストがあるか確認
- 「※補助金対象外※」のマークがあるか確認
- 複数ページの場合、各ページの図面名称が「新設 平面図」「既設 平面図」となっているか確認
` : `### 基礎充電の追加確認
- 路面表示のチェックは不要です（目的地充電のみ必要な項目）
- 周辺構造物（建物、駐輪場、フェンス、縁石、道路等）の描画を確認
- マンション・団地の建物名称が図面上にあるか確認
`}

### 重要な注意事項
- 「該当する場合のみ」のチェック項目は、該当しない場合（例：既設設備が存在しない場合）は **pass** としてください
- found_text には図面から読み取れた具体的なテキスト・数値を記載してください。推測は不可です
- 全てのチェック項目について必ず結果を返してください（スキップ不可）
- 図面のどの位置から情報を読み取ったかを detail に含めてください`;
  }

  // ─── PDF → 画像変換 ────────────────────────────
  const MAX_CANVAS_PIXELS = 16_000_000;
  const MAX_CANVAS_DIM = 4096;

  function calcSafeScale(page, targetScale) {
    const viewport = page.getViewport({ scale: targetScale });
    let w = viewport.width;
    let h = viewport.height;

    if (w > MAX_CANVAS_DIM || h > MAX_CANVAS_DIM) {
      const dimRatio = Math.min(MAX_CANVAS_DIM / w, MAX_CANVAS_DIM / h);
      return targetScale * dimRatio;
    }
    if (w * h > MAX_CANVAS_PIXELS) {
      const pixelRatio = Math.sqrt(MAX_CANVAS_PIXELS / (w * h));
      return targetScale * pixelRatio;
    }
    return targetScale;
  }

  async function pdfToImages(file) {
    let pdf;
    try {
      const arrayBuffer = await file.arrayBuffer();
      pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    } catch (e) {
      throw new Error('PDFファイルの読み込みに失敗しました。ファイルが破損しているか、パスワードで保護されている可能性があります。');
    }

    const images = [];
    const pageCount = pdf.numPages;
    const maxPages = Math.min(pageCount, 5);
    let totalBase64Size = 0;

    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const safeScale = calcSafeScale(page, 3.0);
      const viewport = page.getViewport({ scale: safeScale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');

      await page.render({ canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const base64 = dataUrl.split(',')[1];
      totalBase64Size += base64.length;

      if (totalBase64Size > 18_000_000) {
        console.warn(`ページ${i}でペイロードサイズ上限に近づいたため、以降のページをスキップします`);
        canvas.width = 0;
        canvas.height = 0;
        break;
      }

      images.push({ base64, mimeType: 'image/jpeg', pageNum: i });

      canvas.width = 0;
      canvas.height = 0;
    }

    if (images.length === 0) {
      throw new Error('PDFから画像を生成できませんでした。');
    }

    return { images, pageCount };
  }

  // ─── プレビュー用画像生成 ──────────────────────
  async function pdfToPreview(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const safeScale = calcSafeScale(page, 1.5);
    const viewport = page.getViewport({ scale: safeScale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas;
  }

  // ─── 利用可能モデル定義 ─────────────────────────
  const MODELS = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', tier: 'free' },
    { id: 'gemini-2.5-pro',   name: 'Gemini 2.5 Pro',   tier: 'paid' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', tier: 'free' },
  ];

  // ─── モデル別接続テスト ────────────────────────
  async function verifyModel(apiKey, modelId) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}?key=${apiKey}`,
        { method: 'GET' }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return { available: false, reason: data?.error?.message || `HTTP ${response.status}` };
      }
      return { available: true, reason: '' };
    } catch (e) {
      return { available: false, reason: '接続エラー' };
    }
  }

  // ─── 全モデル一括接続テスト ────────────────────
  async function verifyAllModels(apiKey) {
    const results = {};
    await Promise.all(MODELS.map(async (model) => {
      results[model.id] = await verifyModel(apiKey, model.id);
    }));
    return results;
  }

  // ─── Gemini API 呼び出し ───────────────────────
  async function callGemini(apiKey, images, type, modelId) {
    const prompt = buildPrompt(type);

    const imageParts = images.map(img => ({
      inline_data: {
        mime_type: img.mimeType,
        data: img.base64,
      }
    }));

    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            ...imageParts,
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    };

    const useModel = modelId || 'gemini-2.5-flash';
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${useModel}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `API エラー (${response.status})`);
    }

    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      const blockReason = data.promptFeedback?.blockReason;
      if (blockReason) {
        throw new Error(`Gemini がリクエストをブロックしました（理由: ${blockReason}）。別の図面で再試行してください。`);
      }
      throw new Error('Gemini から応答が返りませんでした。しばらく待ってから再試行してください。');
    }

    const candidate = data.candidates[0];
    if (candidate.finishReason === 'SAFETY') {
      throw new Error('Gemini の安全フィルタにより応答がブロックされました。図面の内容を確認してください。');
    }

    // Gemini 2.5系モデルは「thinking」パートを先頭に返す場合がある
    // 最後のtextパートを取得することでJSON出力を確実に読み取る
    const parts = candidate?.content?.parts || [];
    let text = null;
    for (let pi = parts.length - 1; pi >= 0; pi--) {
      if (parts[pi].text != null) {
        text = parts[pi].text;
        break;
      }
    }
    if (!text) {
      throw new Error('Gemini から有効なテキスト応答が得られませんでした。再試行してください。');
    }

    let jsonStr = text;
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    }

    try {
      return JSON.parse(jsonStr.trim());
    } catch (parseErr) {
      console.error('Gemini応答のJSONパースに失敗:', text.substring(0, 500));
      throw new Error('Gemini の応答を解析できませんでした。再試行してください。');
    }
  }

  // ─── API キー検証 ─────────────────────────────
  async function verifyApiKey(apiKey) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { method: 'GET' }
    );
    return response.ok;
  }

  // ─── 結果集計 ──────────────────────────────────
  function aggregateResults(geminiResult, type) {
    const checks = type === 'kiso'
      ? [...COMMON_CHECKS, ...KISO_CHECKS]
      : [...COMMON_CHECKS, ...MOKUTEKICHI_CHECKS];

    const resultMap = {};
    if (geminiResult.results) {
      geminiResult.results.forEach(r => { resultMap[r.id] = r; });
    }

    const items = checks.map(check => {
      const result = resultMap[check.id] || { status: 'fail', found_text: '', detail: '判定結果が取得できませんでした' };
      return {
        ...check,
        status: result.status,
        found_text: result.found_text || '',
        detail: result.detail || '',
      };
    });

    const categoryResults = {};
    items.forEach(item => {
      if (!categoryResults[item.category]) {
        categoryResults[item.category] = { items: [], pass: 0, fail: 0, warn: 0, total: 0 };
      }
      const cat = categoryResults[item.category];
      cat.items.push(item);
      cat.total++;
      if (item.status === 'pass') cat.pass++;
      else if (item.status === 'fail') cat.fail++;
      else cat.warn++;
    });

    const totalRequired = items.filter(i => i.required);
    const requiredPass = totalRequired.filter(i => i.status === 'pass').length;
    const requiredFail = totalRequired.filter(i => i.status === 'fail').length;
    const totalPass = items.filter(i => i.status === 'pass').length;

    let overall;
    if (requiredFail === 0) {
      overall = 'pass';
    } else if (requiredFail <= 2) {
      overall = 'warn';
    } else {
      overall = 'fail';
    }

    return {
      items,
      categoryResults,
      overall,
      totalPass,
      totalItems: items.length,
      requiredPass,
      requiredTotal: totalRequired.length,
      requiredFail,
      overallComment: geminiResult.overall_comment || '',
      detectedInfo: geminiResult.detected_info || {},
    };
  }

  // ─── メインチェック実行 ────────────────────────
  async function check(apiKey, file, type, modelId) {
    const { images, pageCount } = await pdfToImages(file);
    const geminiResult = await callGemini(apiKey, images, type, modelId);
    const aggregated = aggregateResults(geminiResult, type);
    aggregated.pageCount = pageCount;
    aggregated.analyzedPages = images.length;
    return aggregated;
  }

  // ─── 結果テキスト出力 ──────────────────────────
  function resultToText(result, type) {
    const typeLabel = type === 'kiso' ? '基礎充電' : '目的地充電';
    let text = `=== NeV 平面図 要件判定結果 ===\n`;
    text += `図面タイプ: ${typeLabel}\n`;
    text += `判定: ${result.overall === 'pass' ? '合格' : result.overall === 'warn' ? '要確認' : '不合格'}\n`;
    text += `合格項目: ${result.totalPass} / ${result.totalItems}\n`;
    text += `必須項目: ${result.requiredPass} / ${result.requiredTotal}\n\n`;

    // 読み取り情報
    const info = result.detectedInfo;
    if (info) {
      text += `--- 読み取り情報 ---\n`;
      if (info.facility_name) text += `施設名: ${info.facility_name}\n`;
      if (info.drawing_title) text += `図面名称: ${info.drawing_title}\n`;
      if (info.creator) text += `作成者: ${info.creator}\n`;
      if (info.scale) text += `縮尺: ${info.scale}\n`;
      if (info.creation_date) text += `作成日: ${info.creation_date}\n`;
      if (info.equipment_count) text += `EV充電設備: ${info.equipment_count}\n`;
      if (info.space_count) text += `充電スペース: ${info.space_count}\n`;
      text += '\n';
    }

    text += `--- 項目別結果 ---\n`;
    result.items.forEach(item => {
      const icon = item.status === 'pass' ? '[OK]' : item.status === 'fail' ? '[NG]' : '[!?]';
      text += `${icon} ${item.label}${item.required ? '' : ' [任意]'}\n`;
      if (item.found_text) text += `    検出: ${item.found_text}\n`;
      if (item.detail) text += `    詳細: ${item.detail}\n`;
      text += '\n';
    });

    if (result.overallComment) {
      text += `--- AI コメント ---\n${result.overallComment}\n`;
    }

    return text;
  }

  // ─── 公開API ──────────────────────────────────
  return {
    check,
    verifyApiKey,
    verifyModel,
    verifyAllModels,
    pdfToPreview,
    resultToText,
    CATEGORIES,
    MODELS,
    COMMON_CHECKS,
    KISO_CHECKS,
    MOKUTEKICHI_CHECKS,
  };

})();