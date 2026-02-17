# 2026 F1 Car — Component & Dimension Specification

> **用途**: F1 Simulator 建模規格
> **來源**: FIA 2026 Technical Regulations Section C Issue 12 + 車隊公開資訊
> **座標系**: X 向後為正 / Y 向駕駛左側為正 / Z 向上為正 / 原點 = 前軸中線 × 車體中線 × 參考平面

---

## 1. 整車尺寸

| 參數                      | 值               |
| ------------------------- | ---------------- |
| 最大軸距                  | 3,400 mm         |
| 最大車寬                  | 1,900 mm         |
| 最低車重（含駕駛 + 輪胎） | 768 kg           |
| 車體淨重（不含輪胎）      | 722 kg           |
| 輪胎總重（估計）          | 46 kg            |
| 輪圈直徑                  | 18 吋 (457.2 mm) |
| 前胎胎面寬                | ~280 mm          |
| 後胎胎面寬                | ~370 mm          |

---

## 2. 前翼 (Front Wing Assembly)

### 2.1 幾何

| 參數                   | 值                                           |
| ---------------------- | -------------------------------------------- |
| 翼型元件數             | 3（最大）                                    |
| 翼展                   | 收於前輪內側，比車寬窄約 100 mm              |
| 翼形                   | 強制弧形匙形 (Spoon Profile)                 |
| 活動翼瓣 (Active Flap) | 2 片                                         |
| 翼柱 (Pylon)           | 連接鼻錐下方，翼型下方突出部分於翼柱下方裁切 |
| 組件間 Fillet Radius   | ≤ 10 mm                                      |

### 2.2 子組件

| 子組件                       | 說明                                   |
| ---------------------------- | -------------------------------------- |
| Front Wing Profiles          | 3 片翼型，受 Reference Volume 嚴格定義 |
| Front Wing Endplate Body     | 端板主體，外側有較大設計自由度         |
| Front Wing Inboard Footplate | 內側底板，全新規範幾何                 |
| Front Wing Pylon             | 翼柱，翼與鼻錐的連接結構               |

### 2.3 Active Aero

| 模式          | 翼瓣狀態     | 觸發                      |
| ------------- | ------------ | ------------------------- |
| Corner Mode   | 關閉（預設） | 離開 pit / 進彎前自動復位 |
| Straight Mode | 開啟         | 駕駛手動，≥3 秒直線段可用 |

---

## 3. 鼻錐 & 前撞擊結構 (Nose & FIS)

| 參數          | 值                                      |
| ------------- | --------------------------------------- |
| FIS 類型      | 兩階段式 (Two-Stage)                    |
| 鼻錐-前翼關係 | 分離式 (Detached)，鼻錐不與前翼直接成型 |
| 材質          | 碳纖維複合材料                          |
| 連接          | 與存活艙前端固定                        |
| Stage 1 功能  | 初次碰撞能量吸收                        |
| Stage 2 功能  | 殘餘結構完整性，防二次碰撞裸露          |

---

## 4. 存活艙 / 單體殼 (Survival Cell)

| 參數         | 值                                                            |
| ------------ | ------------------------------------------------------------- |
| 材質         | 碳纖維複合材料                                                |
| 安裝基準點   | 前端上方 1 點 / 頂部 Y=0 對稱 2 點 / 後端 RIS 或齒輪箱殼 1 點 |
| 駕駛艙開口   | 受規範嚴格定義                                                |
| 側面侵入防護 | 強化等級，座艙與燃料箱區域加倍                                |

### 4.1 鼻錐-存活艙過渡

從鼻錐到駕駛艙的上表面幾何為全車身規定 (fully prescribed)，設計自由度極低。

---

## 5. Halo

| 參數                | 值                                    |
| ------------------- | ------------------------------------- |
| 材質                | Grade 5 鈦合金 (Ti-6Al-4V)            |
| 重量                | ~9 kg                                 |
| 固定點              | 3（前方 1 + 後方 2）                  |
| 幾何規範            | FIA Standard 8869                     |
| 防滾架載荷等級      | 20G                                   |
| 周圍翼片 (Winglets) | 允許，受 regulatory bounding box 限制 |

---

## 6. 側箱 (Sidepods)

### 6.1 進氣口

| 參數            | 值                             |
| --------------- | ------------------------------ |
| 進氣口掃掠角    | 較大（規則允許範圍內自由設計） |
| 設計趨勢        | Coke-bottle 縮腰造型           |
| 底切 (Undercut) | 關鍵空力設計區域               |

### 6.2 頂部結構

| 組件                 | 說明                                         |
| -------------------- | -------------------------------------------- |
| 氣箱 (Airbox)        | 三角形截面，位於駕駛頭枕後方上方             |
| 角翼 (Horn Winglets) | 氣箱兩側，通常 2 片，受 regulatory box 限制  |
| 鯊魚鰭 (Shark Fin)   | 引擎蓋到後翼的垂直延伸面，邊緣可設計為鋸齒形 |
| Cobra Vane           | 底板上方的導流片（部分車隊使用）             |

### 6.3 內部配置

| 組件       | 說明                                             |
| ---------- | ------------------------------------------------ |
| 引擎體積區 | 90° V6 坐落於規範體積箱內，原為 2013 V8 設計空間 |
| 引擎安裝   | 前後各 4× M12 螺栓                               |
| 中冷器     | 微管水冷式，體積極小，可置於 V 型汽缸夾角中      |
| LTR 散熱器 | 低溫散熱器，可置於引擎上方                       |
| 電池組     | 大容量，350 kW MGU-K 對應                        |

---

## 7. 導流板 / 車身中段 (Wheel Wake Control Boards & Mid-Body)

### 7.1 Wheel Wake Control Boards (WWCB)

| 參數       | 值                            |
| ---------- | ----------------------------- |
| 位置       | 側箱前方，前輪後方            |
| 氣流方向   | 強制 inwash（向車身中線方向） |
| 設計自由度 | 角度、方向受嚴格限制          |

### 7.2 鏡組 (Mirrors)

| 組件                 | 說明                     |
| -------------------- | ------------------------ |
| Mirror Body          | 受 Reference Volume 定義 |
| Mirror Rear Stay     | 後支撐結構               |
| 組件間 Fillet Radius | ≤ 10 mm                  |

### 7.3 駕駛冷卻 (Driver Cooling)

| 參數          | 值      |
| ------------- | ------- |
| 存在性        | 選配    |
| Fillet Radius | ≤ 10 mm |

---

## 8. 底板 (Floor Assembly)

### 8.1 幾何

| 參數         | 值                            |
| ------------ | ----------------------------- |
| 類型         | 部分平坦底板 (Partially Flat) |
| 文丘里隧道   | 無                            |
| 底板最大寬度 | 車寬 − 150 mm 區域            |
| 底板入口高度 | 低於前代，無導流片引導        |
| Ride Height  | 較高需求，允許更寬 setup 範圍 |

### 8.2 子組件

| 組件         | 說明                                           |
| ------------ | ---------------------------------------------- |
| Floor Body   | 底板主體，受 Reference Volume 定義             |
| Floor Foot   | 底板腳部                                       |
| Splitter     | 前緣分流器                                     |
| Bib / Keel   | 底板前端與車身連接區，車隊可選擇三角形截面大小 |
| Floor Boards | 底板上的 inwash 導流板                         |

### 8.3 木板 & 鈦滑塊 (Plank & Skids)

| 參數                  | 值                                                         |
| --------------------- | ---------------------------------------------------------- |
| 木板材質              | FIA 指定 (FIA-F1-DOC-Cxxx)                                 |
| 滑塊材質              | 鈦合金 AMS4928 或 AMS4911（退火態，從實心加工）            |
| 滑塊總面積 (下方投影) | ≤ 18,000 mm²                                               |
| 滑塊單片面積          | ≤ 4,000 mm²                                                |
| 安裝密度              | ≥ 1 fastener / 1,000 mm²                                   |
| 面積分佈              | XF=600 前 ≤ 8,000 mm² / XF=600–XC=0 ≤ 5,000 mm² / 其餘後方 |
| 滑塊上表面最低 Z      | −3 mm                                                      |

---

## 9. 擴散器 (Diffuser)

| 參數                   | 值                                            |
| ---------------------- | --------------------------------------------- |
| 長度                   | 大幅延長（精確值受 Reference Volume 定義）    |
| 高度                   | 更高開口                                      |
| 擴張比                 | 增大，為主要下壓力生成區域                    |
| 側壁開孔 (Mouse House) | 允許，尺寸放大                                |
| 與後輪關係             | 後輪 tyre squirt 直接衝擊，需車身結構引導緩解 |

---

## 10. 後翼 (Rear Wing Assembly)

### 10.1 幾何

| 參數                   | 值                       |
| ---------------------- | ------------------------ |
| 翼型元件數             | 3（三元件）              |
| Beam Wing              | 無（已移除）             |
| RW-Flap 最大外展       | Y = 535 mm               |
| 端板                   | 簡化幾何                 |
| 翼撐 (Rear Wing Brace) | 受 Reference Volume 定義 |
| 組件間 Fillet Radius   | ≤ 10 mm                  |

### 10.2 Active Aero

| 模式          | 翼瓣狀態     | 觸發                           |
| ------------- | ------------ | ------------------------------ |
| Corner Mode   | 關閉（預設） | 自動復位                       |
| Straight Mode | 開啟         | 駕駛手動，所有車手所有圈次皆可 |

### 10.3 端板附加元件

| 組件       | 說明                      |
| ---------- | ------------------------- |
| ERS 狀態燈 | 端板上，指示回收/部署狀態 |
| 側面安全燈 | 側向可見性                |
| 後雨燈     | 保留                      |

---

## 11. 尾部車身 (Tail & Exhaust)

| 組件                    | 說明                               |
| ----------------------- | ---------------------------------- |
| Exhaust Tailpipe        | 受 Reference Volume 定義位置與幾何 |
| Tail Bodywork           | 與後翼修剪組合                     |
| 後翼-尾部 Fillet Radius | ≤ 10 mm                            |

---

## 12. 懸吊 (Suspension)

### 12.1 前懸吊

| 參數                         | 值                                      |
| ---------------------------- | --------------------------------------- |
| 類型                         | 推桿 (Pushrod)                          |
| 幾何配置                     | 雙叉臂 (Wishbone) 或多連桿 (Multi-link) |
| Anti-dive                    | 允許，A 臂側視圖向後傾斜                |
| 轉向拉桿                     | 可置於懸吊前方或後方低位                |
| 整流罩 (Suspension Fairings) | 受 Article C3.17 定義                   |

### 12.2 後懸吊

| 參數 | 值               |
| ---- | ---------------- |
| 類型 | 推桿 (Pushrod)   |
| 整合 | 與變速箱殼體連接 |

---

## 13. 輪組 & 煞車 (Wheels & Brakes)

### 13.1 輪組

| 參數                | 值                  |
| ------------------- | ------------------- |
| 輪圈                | 18 吋               |
| 前胎胎面寬          | ~280 mm             |
| 後胎胎面寬          | ~370 mm             |
| 輪蓋 (Wheel Covers) | 車隊自行設計        |
| 前輪拱              | 無                  |
| 輪胎溫度感測器      | 每輪 1 個，含整流罩 |
| 化合物              | C1–C5 (Pirelli)     |

### 13.2 煞車導風管

| 參數                            | 值                                 |
| ------------------------------- | ---------------------------------- |
| 前煞車導風管                    | 精細設計，受 Reference Volume 定義 |
| 後煞車導風管                    | 受 Reference Volume 定義           |
| 前輪車身 (Front Wheel Bodywork) | 部分強制幾何，用於 wake 優化       |
| 後輪車身 (Rear Wheel Bodywork)  | 受 Articles C3.14 / C3.15 定義     |

---

## 14. 動力單元 (Power Unit)

### 14.1 ICE

| 參數       | 值                                          |
| ---------- | ------------------------------------------- |
| 排量       | 1.6 L                                       |
| 配置       | 90° V6 渦輪增壓                             |
| 最大功率   | ~400 kW                                     |
| 體積區     | 沿用 2013 V8 規範體積箱（約大 10 cm 高/長） |
| 曲軸中心線 | 規範位置不變                                |
| 安裝       | 前後各 4× M12                               |

### 14.2 ERS

| 組件           | 值                         |
| -------------- | -------------------------- |
| MGU-H          | 無                         |
| MGU-K 功率     | 350 kW                     |
| 每圈可回收能量 | 8.5 MJ                     |
| 電池           | 大容量鋰電池組             |
| 功率分配       | ICE ≈ 50% / Electric ≈ 50% |
| 總功率         | ~750 kW                    |

### 14.3 燃料系統

| 參數     | 值                                    |
| -------- | ------------------------------------- |
| 燃料類型 | 100% 永續碳中和燃料                   |
| 流量管制 | 基於能量含量 & 能量密度（非質量流量） |
| FIA 檢驗 | 賽前/賽後強制取樣分析                 |

### 14.4 部署模式

| 模式          | 觸發條件              | 可用範圍                         |
| ------------- | --------------------- | -------------------------------- |
| Boost Mode    | 駕駛按鈕              | 任何位置、任何時間               |
| Overtake Mode | 前方 1 秒內（偵測點） | 下一圈全程可用，可一次或分段部署 |
| Recharge      | 煞車 / 收油 / 滑行    | 自動                             |

#### Overtake Mode 速度限制

| 角色   | MGU-K 功率 | 部署上限速度                      | 額外能量 |
| ------ | ---------- | --------------------------------- | -------- |
| 領先車 | 正常遞減   | 290 km/h 開始遞減 → 355 km/h 歸零 | —        |
| 追擊車 | 350 kW     | 至 337 km/h                       | +0.5 MJ  |

---

## 15. 變速箱 (Gearbox)

| 參數           | 值              |
| -------------- | --------------- |
| 類型           | 序列式半自動    |
| 檔位           | 8 前進 + 1 倒退 |
| 殼體材質       | 碳纖維或鋁合金  |
| 後懸吊整合     | 是              |
| 後撞擊結構整合 | 是              |

---

## 16. 安全結構 & 燈號

### 16.1 結構

| 組件                 | 規格                         |
| -------------------- | ---------------------------- |
| Halo                 | Ti-6Al-4V / ~9 kg / 3 點固定 |
| 防滾架 (Roll Hoop)   | 20G 載荷等級                 |
| FIS                  | 兩階段式碳纖維               |
| 側面侵入             | 強化，燃料箱區域防護加倍     |
| 輪栓 (Wheel Tethers) | 保留                         |

### 16.2 燈號

| 位置     | 類型           |
| -------- | -------------- |
| 後翼端板 | ERS 狀態指示燈 |
| 車身側面 | 側向安全燈     |
| 車尾     | 雨燈（保留）   |

---

## 17. Final Assembly 順序

FIA 規範的車身組裝順序（影響幾何合法性檢查）：

```
1. Front Wing Bodywork + Nose Bodywork → 修剪接合
2. Rear Wing Bodywork + Tail Bodywork → 修剪接合 (fillet ≤ 10mm)
3. Front Bodywork + Rear Bodywork → 修剪為 Upper Bodywork (fillet ≤ 50mm)
4. Upper Bodywork + Floor Assembly → 修剪接合
   - 交線不得產生超過 1 條曲線
   - Mid Chassis 與 Floor Bodywork 可從下方可見
```

### 17.1 合規公差

| 區域                      | 公差                             |
| ------------------------- | -------------------------------- |
| 一般車身                  | ±2 mm（Reference Volume 對齊後） |
| Z=0 平面上的零件          | Z = ±2 mm                        |
| Reference Volume 重新對齊 | 允許 ≤ 2 mm 偏移以最佳擬合       |

---

## 18. Simulator 建模 TypeScript Interface 總覽

```typescript
interface F1Car2026 {
  dimensions: {
    maxWheelbase: 3400 // mm
    maxWidth: 1900 // mm
    minWeight: 768 // kg including driver + tyres
    dryWeight: 722 // kg car only
  }

  frontWing: {
    profiles: 3
    activeFlaps: 2
    shape: 'spoon'
    endplate: EndplateSpec
    footplate: FootplateSpec
    pylon: PylonSpec
    modes: {
      corner: { flapAngle: number } // deg, closed
      straight: { flapAngle: number } // deg, open
    }
  }

  nose: {
    type: 'detached_from_wing'
    fis: { stages: 2; material: 'carbon_composite' }
  }

  survivalCell: {
    material: 'carbon_composite'
    sideIntrusionLevel: 'enhanced'
    fuelCellProtection: 'doubled'
    datumPoints: 4
  }

  halo: {
    material: 'Ti-6Al-4V'
    weight: 9 // kg approx
    mountPoints: 3
    rollHoopG: 20
    winglets: boolean
  }

  sidepods: {
    airbox: { shape: 'triangular' }
    sharkFin: boolean
    hornWinglets: number // typically 2
    cobraVane: boolean
  }

  wwcb: {
    flowDirection: 'inwash'
    position: 'ahead_of_sidepods'
  }

  floor: {
    type: 'partially_flat'
    venturiTunnels: false
    plank: {
      skidMaterial: 'titanium'
      skidMaxTotalArea: 18000 // mm²
      skidMaxSingleArea: 4000 // mm²
      skidMinZ: -3 // mm
    }
  }

  diffuser: {
    size: 'extended'
    mouseHole: boolean
    expansionRatio: number
  }

  rearWing: {
    profiles: 3
    beamWing: false
    maxFlapY: 535 // mm
    activeFlaps: boolean
    modes: {
      corner: { flapAngle: number }
      straight: { flapAngle: number }
    }
    lights: {
      ersStatus: boolean
      lateralSafety: boolean
      rearRain: boolean
    }
  }

  wheels: {
    rimSize: 18 // inches
    frontTyreWidth: 280 // mm approx
    rearTyreWidth: 370 // mm approx
    frontArches: false
    coverDesign: 'team_specific'
    compounds: ['C1', 'C2', 'C3', 'C4', 'C5']
  }

  suspension: {
    front: { type: 'pushrod'; geometry: 'wishbone' | 'multilink' }
    rear: { type: 'pushrod'; gearboxMounted: true }
  }

  powerUnit: {
    ice: { displacement: 1.6; config: 'V6_90_turbo'; power: 400 }
    mguH: null
    mguK: { power: 350; energyPerLap: 8.5 }
    totalPower: 750 // kW
    split: '50:50'
    fuel: '100%_sustainable'
    modes: ['boost', 'overtake', 'recharge']
    overtake: {
      triggerGap: 1 // second
      chaserMaxSpeed: 337 // km/h
      chaserExtraEnergy: 0.5 // MJ
      leaderTaperStart: 290 // km/h
      leaderTaperZero: 355 // km/h
    }
  }

  gearbox: {
    type: 'sequential_semi_auto'
    forwardGears: 8
    reverseGears: 1
  }

  assembly: {
    bodyworkTolerance: 2 // mm
    filletRadiusSmall: 10 // mm (wing junctions)
    filletRadiusLarge: 50 // mm (upper bodywork join)
  }
}
```

---

## 19. Livery Texture Specification

### 19.1 Texture Requirements

| Texture              | Current Size   | Recommended                | Format |
| -------------------- | -------------- | -------------------------- | ------ |
| Base Color (livery)  | 2048 × 2048 px | 2048 × 2048 or 4096 × 4096 | PNG    |
| Metallic / Roughness | 512 × 512 px   | 512 × 512 or 1024 × 1024   | PNG    |

- Aspect ratio: **1:1** (square)
- UV coverage: full 0–1 range (U: 0.0000–0.9940, V: 0.0167–1.0000)
- UV Map name: `UVMap` (default active)
- Material name in GLB: `Livery.001`

### 19.2 Model Mesh Breakdown

```
f1_2026.glb
├── Car_Livery_0          # Main body — 75,905 verts / 107,567 faces
├── Car_Livery_0.001      # Secondary body — 21,318 verts / 26,853 faces
├── Car_RearLight_0       # Rear light — 10,772 verts
├── Wheel_FL / FR         # Front tires — 660 verts each (diameter 0.740 m)
├── Wheel_RL / RR         # Rear tires — 660 verts each (diameter 0.667 m)
└── WheelCover_FL / FR / RL / RR  # Wheel covers — ~8,300 verts each
```

Both `Car_Livery_0` and `Car_Livery_0.001` share `Livery.001` material and UV layout.

### 19.3 Actual Model Dimensions (Blender Measured)

| Mesh             | Width (Y)       | Length (X)    | Height (Z) |
| ---------------- | --------------- | ------------- | ---------- |
| Car_Livery_0     | 1.804 m         | 5.204 m       | 1.135 m    |
| Car_Livery_0.001 | 1.352 m         | 4.994 m       | 1.135 m    |
| Front Wheel      | 0.381 m (width) | 0.740 m (dia) | —          |
| Rear Wheel       | 0.400 m (width) | 0.740 m (dia) | —          |

### 19.4 UV Layout Regions

```
┌─────────────────────────────────────────┐
│  Side panels (L/R)   │  Floor / Diffuser│
│  Engine cover top    │  Underbody panels │
├──────────────────────┼──────────────────┤
│  Nose cone           │  Small details    │
│  Sidepod             │  Wheel covers     │
│  Cockpit surround    │  Mechanical parts │
├──────────────────────┴──────────────────┤
│  Front wing  │  Rear wing  │  Suspension │
│  Endplates   │  DRS flap   │  Thin parts │
└─────────────────────────────────────────┘
```

### 19.5 Reference Files

| File                                   | Description                                            |
| -------------------------------------- | ------------------------------------------------------ |
| `uv_layout_car_body.png`               | UV wireframe template (4096 × 4096) — use as top layer |
| `livery_baseColor_current.png`         | Current base color texture (2048 × 2048)               |
| `livery_metallicRoughness_current.png` | Current metallic/roughness map (512 × 512)             |

### 19.6 Painting Workflow

1. Open `uv_layout_car_body.png` in your editor (Photoshop / Procreate / Krita)
2. Set it as the top layer (multiply blend mode)
3. Paint your livery design on layers below
4. Export as **2048 × 2048 PNG** (or 4096 for high-res)
5. Replace `Livery_baseColor` texture in the GLB

### 19.7 Metallic / Roughness Map (Optional)

glTF packs metallic-roughness into a single texture:

| Channel | Property   | 0 Value                    | 1 Value     |
| ------- | ---------- | -------------------------- | ----------- |
| R       | — (unused) | —                          | —           |
| G       | Roughness  | Glossy / mirror            | Fully matte |
| B       | Metallic   | Dielectric (paint, rubber) | Pure metal  |

Typical values:

| Surface        | Metallic (B) | Roughness (G) |
| -------------- | ------------ | ------------- |
| Glossy paint   | 0.0          | 0.15–0.25     |
| Matte paint    | 0.0          | 0.6–0.8       |
| Carbon fiber   | 0.3–0.5      | 0.2–0.4       |
| Chrome / metal | 1.0          | 0.05–0.15     |

### 19.8 In-Game Weather Effects

The game dynamically overrides materials based on weather:

| Condition | Roughness Override | Env Map Intensity      |
| --------- | ------------------ | ---------------------- |
| Dry       | As painted         | Normal                 |
| Rain      | min(current, 0.15) | 2.5× (wet reflections) |

Tire sidewall colors are overridden per compound (C1–C5) — no need to paint wheels.
