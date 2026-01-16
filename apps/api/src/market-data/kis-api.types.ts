/**
 * KIS API 타입 정의
 * 한국투자증권 OpenAPI 응답 타입
 */

// ============================================
// 계좌 잔고 조회
// ============================================

export interface KISAccountBalanceOutput1 {
  dnca_tot_amt: string;      // 예수금 총액
  nxdy_excc_amt: string;     // 익일 정산금액
  prvs_rcdl_excc_amt: string;// 가수도 정산금액
  cma_evlu_amt: string;      // CMA 평가금액
  bfdy_buy_amt: string;      // 전일 매수금액
  thdt_buy_amt: string;      // 금일 매수금액
  bfdy_sll_amt: string;      // 전일 매도금액
  thdt_sll_amt: string;      // 금일 매도금액
  d2_auto_rdpt_amt: string;  // D+2 자동 상환금액
  bfdy_tlex_amt: string;     // 전일 제비용금액
  thdt_tlex_amt: string;     // 금일 제비용금액
  tot_loan_amt: string;      // 총 대출금액
  scts_evlu_amt: string;     // 유가증권 평가금액
  tot_evlu_amt: string;      // 총 평가금액
  nass_amt: string;          // 순자산금액
  fncg_gld_auto_rdpt_yn: string; // 융자금 자동상환여부
  pchs_amt_smtl_amt: string; // 매입금액 합계금액
  evlu_amt_smtl_amt: string; // 평가금액 합계금액
  evlu_pfls_smtl_amt: string;// 평가손익 합계금액
  tot_stln_slng_chgs: string;// 총 대주 매각 대금
  bfdy_tot_asst_evlu_amt: string; // 전일 총자산 평가금액
  asst_icdc_amt: string;     // 자산 증감금액
  asst_icdc_erng_rt: string; // 자산 증감 수익율
}

export interface KISAccountBalanceOutput2 {
  pdno: string;              // 상품번호 (종목코드)
  prdt_name: string;         // 상품명
  trad_dvsn_name: string;    // 거래구분명
  bfdy_buy_qty: string;      // 전일 매수수량
  bfdy_sll_qty: string;      // 전일 매도수량
  thdt_buyqty: string;       // 금일 매수수량
  thdt_sll_qty: string;      // 금일 매도수량
  hldg_qty: string;          // 보유수량
  ord_psbl_qty: string;      // 주문가능수량
  pchs_avg_pric: string;     // 매입평균가격
  pchs_amt: string;          // 매입금액
  prpr: string;              // 현재가
  evlu_amt: string;          // 평가금액
  evlu_pfls_amt: string;     // 평가손익금액
  evlu_pfls_rt: string;      // 평가손익율
  evlu_erng_rt: string;      // 평가수익율
  loan_dt: string;           // 대출일자
  loan_amt: string;          // 대출금액
  stln_slng_chgs: string;    // 대주 매각대금
  expd_dt: string;           // 만기일자
  fltt_rt: string;           // 등락율
  bfdy_cprs_icdc: string;    // 전일대비 증감
  item_mgna_rt_name: string; // 종목 증거금율 명
  grta_rt_name: string;      // 보증금율명
  sbst_pric: string;         // 대용가격
  stck_loan_unpr: string;    // 주식 대출 단가
}

export interface KISAccountBalanceResponse {
  rt_cd: string;
  msg_cd: string;
  msg1: string;
  ctx_area_fk100: string;
  ctx_area_nk100: string;
  output1: KISAccountBalanceOutput1[];
  output2: KISAccountBalanceOutput2[];
}

// ============================================
// 호가 조회
// ============================================

export interface KISOrderbookResponse {
  rt_cd: string;
  msg_cd: string;
  msg1: string;
  output1: {
    aspr_acpt_hour: string;  // 호가 접수 시간
    askp1: string;           // 매도호가1
    askp2: string;           // 매도호가2
    askp3: string;           // 매도호가3
    askp4: string;           // 매도호가4
    askp5: string;           // 매도호가5
    askp6: string;           // 매도호가6
    askp7: string;           // 매도호가7
    askp8: string;           // 매도호가8
    askp9: string;           // 매도호가9
    askp10: string;          // 매도호가10
    bidp1: string;           // 매수호가1
    bidp2: string;           // 매수호가2
    bidp3: string;           // 매수호가3
    bidp4: string;           // 매수호가4
    bidp5: string;           // 매수호가5
    bidp6: string;           // 매수호가6
    bidp7: string;           // 매수호가7
    bidp8: string;           // 매수호가8
    bidp9: string;           // 매수호가9
    bidp10: string;          // 매수호가10
    askp_rsqn1: string;      // 매도호가 잔량1
    askp_rsqn2: string;      // 매도호가 잔량2
    askp_rsqn3: string;      // 매도호가 잔량3
    askp_rsqn4: string;      // 매도호가 잔량4
    askp_rsqn5: string;      // 매도호가 잔량5
    askp_rsqn6: string;      // 매도호가 잔량6
    askp_rsqn7: string;      // 매도호가 잔량7
    askp_rsqn8: string;      // 매도호가 잔량8
    askp_rsqn9: string;      // 매도호가 잔량9
    askp_rsqn10: string;     // 매도호가 잔량10
    bidp_rsqn1: string;      // 매수호가 잔량1
    bidp_rsqn2: string;      // 매수호가 잔량2
    bidp_rsqn3: string;      // 매수호가 잔량3
    bidp_rsqn4: string;      // 매수호가 잔량4
    bidp_rsqn5: string;      // 매수호가 잔량5
    bidp_rsqn6: string;      // 매수호가 잔량6
    bidp_rsqn7: string;      // 매수호가 잔량7
    bidp_rsqn8: string;      // 매수호가 잔량8
    bidp_rsqn9: string;      // 매수호가 잔량9
    bidp_rsqn10: string;     // 매수호가 잔량10
    total_askp_rsqn: string; // 총 매도호가 잔량
    total_bidp_rsqn: string; // 총 매수호가 잔량
    ntby_aspr_rsqn: string;  // 순매수 호가 잔량
  };
  output2: {
    stck_prpr: string;       // 현재가
    prdy_vrss: string;       // 전일대비
    prdy_vrss_sign: string;  // 전일대비 부호
    prdy_ctrt: string;       // 전일대비율
    acml_vol: string;        // 누적 거래량
    stck_oprc: string;       // 시가
    stck_hgpr: string;       // 고가
    stck_lwpr: string;       // 저가
    stck_sdpr: string;       // 기준가(전일종가)
  };
}

// ============================================
// 주문 체결/미체결 내역 조회
// ============================================

export interface KISOrderHistoryOutput {
  ord_dt: string;            // 주문일자
  ord_gno_brno: string;      // 주문채번지점번호
  odno: string;              // 주문번호
  orgn_odno: string;         // 원주문번호
  ord_dvsn_name: string;     // 주문구분명
  sll_buy_dvsn_cd: string;   // 매도매수구분코드
  sll_buy_dvsn_cd_name: string; // 매도매수구분코드명
  pdno: string;              // 상품번호
  prdt_name: string;         // 상품명
  ord_qty: string;           // 주문수량
  ord_unpr: string;          // 주문단가
  ord_tmd: string;           // 주문시각
  tot_ccld_qty: string;      // 총체결수량
  avg_prvs: string;          // 평균가
  cncl_yn: string;           // 취소여부
  tot_ccld_amt: string;      // 총체결금액
  loan_dt: string;           // 대출일자
  ordr_empno: string;        // 주문직원번호
  ord_dvsn_cd: string;       // 주문구분코드
  cncl_cfrm_qty: string;     // 취소확인수량
  rmn_qty: string;           // 잔여수량
  rjct_qty: string;          // 거부수량
  ccld_cndt_name: string;    // 체결조건명
  infm_tmd: string;          // 통보시각
  ctac_tlno: string;         // 연락전화번호
  prdt_type_cd: string;      // 상품유형코드
  excg_dvsn_cd: string;      // 거래소구분코드
}

export interface KISOrderHistoryResponse {
  rt_cd: string;
  msg_cd: string;
  msg1: string;
  ctx_area_fk100: string;
  ctx_area_nk100: string;
  output: KISOrderHistoryOutput[];
}

// ============================================
// 주문 정정/취소 응답
// ============================================

export interface KISModifyOrderResponse {
  rt_cd: string;
  msg_cd: string;
  msg1: string;
  output: {
    KRX_FWDG_ORD_ORGNO: string; // 한국거래소 전송주문 조직번호
    ODNO: string;               // 주문번호
    ORD_TMD: string;            // 주문시각
  };
}

// ============================================
// 분봉 차트 (Intraday Candles)
// ============================================

export interface KISIntradayCandleOutput {
  stck_bsop_date: string;    // 영업일자
  stck_cntg_hour: string;    // 체결시각
  stck_prpr: string;         // 현재가
  stck_oprc: string;         // 시가
  stck_hgpr: string;         // 고가
  stck_lwpr: string;         // 저가
  cntg_vol: string;          // 체결거래량
  acml_vol: string;          // 누적거래량
  prdy_vrss: string;         // 전일대비
  prdy_vrss_sign: string;    // 전일대비부호
  prdy_ctrt: string;         // 전일대비율
}

export interface KISIntradayCandleResponse {
  rt_cd: string;
  msg_cd: string;
  msg1: string;
  output1: {
    prdy_vrss: string;       // 전일대비
    prdy_vrss_sign: string;  // 전일대비부호
    prdy_ctrt: string;       // 전일대비율
    stck_prdy_clpr: string;  // 전일종가
    acml_vol: string;        // 누적거래량
    acml_tr_pbmn: string;    // 누적거래대금
    hts_kor_isnm: string;    // HTS 한글종목명
    stck_prpr: string;       // 현재가
  };
  output2: KISIntradayCandleOutput[];
}

// ============================================
// 파싱된 데이터 타입 (서비스에서 반환)
// ============================================

export interface AccountBalance {
  cashBalance: number;           // 예수금
  totalDeposit: number;          // 총 예수금
  totalEvaluation: number;       // 총 평가금액
  totalPurchase: number;         // 총 매입금액
  totalProfitLoss: number;       // 총 평가손익
  profitLossRate: number;        // 수익률 (%)
}

export interface Holding {
  symbol: string;                // 종목코드
  name: string;                  // 종목명
  quantity: number;              // 보유수량
  availableQuantity: number;     // 주문가능수량
  avgPrice: number;              // 평균단가
  currentPrice: number;          // 현재가
  purchaseAmount: number;        // 매입금액
  evaluationAmount: number;      // 평가금액
  profitLoss: number;            // 평가손익
  profitLossRate: number;        // 수익률 (%)
  changeRate: number;            // 등락률 (%)
}

export interface OrderbookEntry {
  price: number;
  quantity: number;
}

export interface Orderbook {
  symbol: string;
  timestamp: Date;
  asks: OrderbookEntry[];        // 매도호가 (낮은가격 우선)
  bids: OrderbookEntry[];        // 매수호가 (높은가격 우선)
  totalAskQuantity: number;      // 총 매도호가 잔량
  totalBidQuantity: number;      // 총 매수호가 잔량
  currentPrice: number;          // 현재가
  changeRate: number;            // 전일대비율
}

export interface OrderHistoryItem {
  orderDate: string;             // 주문일자
  orderNumber: string;           // 주문번호
  originalOrderNumber: string;   // 원주문번호
  symbol: string;                // 종목코드
  name: string;                  // 종목명
  orderType: string;             // 주문구분
  side: 'BUY' | 'SELL';          // 매수/매도
  orderQuantity: number;         // 주문수량
  orderPrice: number;            // 주문가격
  filledQuantity: number;        // 체결수량
  remainingQuantity: number;     // 잔여수량
  avgPrice: number;              // 평균체결가
  totalAmount: number;           // 총체결금액
  isCancelled: boolean;          // 취소여부
  orderTime: string;             // 주문시각
}

export interface IntradayCandle {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  accumulatedVolume: number;
}
