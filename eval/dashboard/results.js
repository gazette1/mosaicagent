window.EVAL_DATA = {
 "latest": {
  "timestamp": "2026-08-01T21:36:53.918Z",
  "commit": "2b6bb5e",
  "overall": 1,
  "cases": [
   {
    "name": "industrial-samples",
    "rubric": {
     "correctness": 1,
     "completeness": 1,
     "consistency": 1,
     "cost": 1
    },
    "score": 1,
    "checks": [
     {
      "label": "deal created",
      "ok": true
     },
     {
      "label": "T12 NOI = 304,600",
      "ok": true
     },
     {
      "label": "NOI confidence >= 0.8",
      "ok": true
     },
     {
      "label": "rent roll: 10 units",
      "ok": true
     },
     {
      "label": "asking price extracted",
      "ok": true
     },
     {
      "label": "verdict KILL at market rates",
      "ok": true
     },
     {
      "label": "DSCR kill flag triggered",
      "ok": true
     },
     {
      "label": "entry cap 6.5-8.5%",
      "ok": true
     },
     {
      "label": "stressed DSCR 0.85-1.1x under adaptive stress",
      "ok": true
     },
     {
      "label": "T12 beats broker email on NOI (claims ledger)",
      "ok": true
     },
     {
      "label": "claims ledger populated with provenance",
      "ok": true
     },
     {
      "label": "trajectory: sources before screen",
      "ok": true
     },
     {
      "label": "trajectory: no invented numbers (all tracked have source or formula)",
      "ok": true
     }
    ]
   },
   {
    "name": "sandcastle-hotel",
    "rubric": {
     "correctness": 1,
     "completeness": 1,
     "consistency": 1,
     "cost": 1
    },
    "score": 1,
    "checks": [
     {
      "label": "keys = 150",
      "ok": true
     },
     {
      "label": "ADR extracted (100-170)",
      "ok": true
     },
     {
      "label": "NOI = 2,843,000 (memo Y3)",
      "ok": true
     },
     {
      "label": "price/basis = 18.4MM order of magnitude",
      "ok": true
     },
     {
      "label": "verdict is not KILL",
      "ok": true
     },
     {
      "label": "DSCR sane (0.5-3.0x)",
      "ok": true
     },
     {
      "label": "workbook generated",
      "ok": true
     },
     {
      "label": "10-sheet institutional layout",
      "ok": true
     },
     {
      "label": "RevPAR is a formula (occ x ADR)",
      "ok": true
     },
     {
      "label": "all-in rate built as index + spread bps",
      "ok": true
     },
     {
      "label": "perm takeout sized as min of three constraints",
      "ok": true
     },
     {
      "label": "sources & uses balance check present",
      "ok": true
     }
    ]
   }
  ],
  "regression": {
   "prevCommit": "14418cd",
   "prevOverall": 1,
   "delta": 0,
   "regressed": false,
   "perCase": [
    {
     "name": "industrial-samples",
     "delta": 0
    },
    {
     "name": "sandcastle-hotel",
     "delta": 0
    }
   ]
  }
 },
 "history": [
  {
   "timestamp": "2026-07-25T13:34:53.367Z",
   "commit": "44b3847",
   "overall": 0.95,
   "cases": [
    {
     "name": "industrial-samples",
     "rubric": {
      "correctness": 0.8,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 0.9,
     "checks": [
      {
       "label": "deal created",
       "ok": true
      },
      {
       "label": "T12 NOI = 304,600",
       "ok": true
      },
      {
       "label": "NOI confidence >= 0.8",
       "ok": true
      },
      {
       "label": "rent roll: 10 units",
       "ok": true
      },
      {
       "label": "asking price extracted",
       "ok": true
      },
      {
       "label": "verdict CHASE",
       "ok": false
      },
      {
       "label": "entry cap 6.5-8.5%",
       "ok": true
      },
      {
       "label": "stressed DSCR 1.0-1.4x",
       "ok": false
      },
      {
       "label": "trajectory: sources before screen",
       "ok": true
      },
      {
       "label": "trajectory: no invented numbers (all tracked have source or formula)",
       "ok": true
      }
     ]
    },
    {
     "name": "sandcastle-hotel",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "keys = 150",
       "ok": true
      },
      {
       "label": "ADR extracted (100-170)",
       "ok": true
      },
      {
       "label": "NOI = 2,843,000 (memo Y3)",
       "ok": true
      },
      {
       "label": "price/basis = 18.4MM order of magnitude",
       "ok": true
      },
      {
       "label": "verdict is not KILL",
       "ok": true
      },
      {
       "label": "DSCR sane (0.5-3.0x)",
       "ok": true
      },
      {
       "label": "workbook generated",
       "ok": true
      },
      {
       "label": "6 sheets present",
       "ok": true
      },
      {
       "label": "hotel rooms revenue is a formula (keys x 365 x occ x ADR)",
       "ok": true
      },
      {
       "label": "rate built as index + spread",
       "ok": true
      }
     ]
    }
   ],
   "regression": null
  },
  {
   "timestamp": "2026-07-25T13:35:39.968Z",
   "commit": "44b3847",
   "overall": 1,
   "cases": [
    {
     "name": "industrial-samples",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "deal created",
       "ok": true
      },
      {
       "label": "T12 NOI = 304,600",
       "ok": true
      },
      {
       "label": "NOI confidence >= 0.8",
       "ok": true
      },
      {
       "label": "rent roll: 10 units",
       "ok": true
      },
      {
       "label": "asking price extracted",
       "ok": true
      },
      {
       "label": "verdict KILL at market rates",
       "ok": true
      },
      {
       "label": "DSCR kill flag triggered",
       "ok": true
      },
      {
       "label": "entry cap 6.5-8.5%",
       "ok": true
      },
      {
       "label": "stressed DSCR 0.9-1.1x",
       "ok": true
      },
      {
       "label": "trajectory: sources before screen",
       "ok": true
      },
      {
       "label": "trajectory: no invented numbers (all tracked have source or formula)",
       "ok": true
      }
     ]
    },
    {
     "name": "sandcastle-hotel",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "keys = 150",
       "ok": true
      },
      {
       "label": "ADR extracted (100-170)",
       "ok": true
      },
      {
       "label": "NOI = 2,843,000 (memo Y3)",
       "ok": true
      },
      {
       "label": "price/basis = 18.4MM order of magnitude",
       "ok": true
      },
      {
       "label": "verdict is not KILL",
       "ok": true
      },
      {
       "label": "DSCR sane (0.5-3.0x)",
       "ok": true
      },
      {
       "label": "workbook generated",
       "ok": true
      },
      {
       "label": "6 sheets present",
       "ok": true
      },
      {
       "label": "hotel rooms revenue is a formula (keys x 365 x occ x ADR)",
       "ok": true
      },
      {
       "label": "rate built as index + spread",
       "ok": true
      }
     ]
    }
   ],
   "regression": {
    "prevCommit": "44b3847",
    "prevOverall": 0.95,
    "delta": 0.05,
    "regressed": false,
    "perCase": [
     {
      "name": "industrial-samples",
      "delta": 0.1
     },
     {
      "name": "sandcastle-hotel",
      "delta": 0
     }
    ]
   }
  },
  {
   "timestamp": "2026-07-25T13:36:17.502Z",
   "commit": "44b3847",
   "overall": 1,
   "cases": [
    {
     "name": "industrial-samples",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "deal created",
       "ok": true
      },
      {
       "label": "T12 NOI = 304,600",
       "ok": true
      },
      {
       "label": "NOI confidence >= 0.8",
       "ok": true
      },
      {
       "label": "rent roll: 10 units",
       "ok": true
      },
      {
       "label": "asking price extracted",
       "ok": true
      },
      {
       "label": "verdict KILL at market rates",
       "ok": true
      },
      {
       "label": "DSCR kill flag triggered",
       "ok": true
      },
      {
       "label": "entry cap 6.5-8.5%",
       "ok": true
      },
      {
       "label": "stressed DSCR 0.9-1.1x",
       "ok": true
      },
      {
       "label": "trajectory: sources before screen",
       "ok": true
      },
      {
       "label": "trajectory: no invented numbers (all tracked have source or formula)",
       "ok": true
      }
     ]
    },
    {
     "name": "sandcastle-hotel",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "keys = 150",
       "ok": true
      },
      {
       "label": "ADR extracted (100-170)",
       "ok": true
      },
      {
       "label": "NOI = 2,843,000 (memo Y3)",
       "ok": true
      },
      {
       "label": "price/basis = 18.4MM order of magnitude",
       "ok": true
      },
      {
       "label": "verdict is not KILL",
       "ok": true
      },
      {
       "label": "DSCR sane (0.5-3.0x)",
       "ok": true
      },
      {
       "label": "workbook generated",
       "ok": true
      },
      {
       "label": "6 sheets present",
       "ok": true
      },
      {
       "label": "hotel rooms revenue is a formula (keys x 365 x occ x ADR)",
       "ok": true
      },
      {
       "label": "rate built as index + spread",
       "ok": true
      }
     ]
    }
   ],
   "regression": {
    "prevCommit": "44b3847",
    "prevOverall": 1,
    "delta": 0,
    "regressed": false,
    "perCase": [
     {
      "name": "industrial-samples",
      "delta": 0
     },
     {
      "name": "sandcastle-hotel",
      "delta": 0
     }
    ]
   }
  },
  {
   "timestamp": "2026-07-25T16:59:07.628Z",
   "commit": "85358fb",
   "overall": 1,
   "cases": [
    {
     "name": "industrial-samples",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "deal created",
       "ok": true
      },
      {
       "label": "T12 NOI = 304,600",
       "ok": true
      },
      {
       "label": "NOI confidence >= 0.8",
       "ok": true
      },
      {
       "label": "rent roll: 10 units",
       "ok": true
      },
      {
       "label": "asking price extracted",
       "ok": true
      },
      {
       "label": "verdict KILL at market rates",
       "ok": true
      },
      {
       "label": "DSCR kill flag triggered",
       "ok": true
      },
      {
       "label": "entry cap 6.5-8.5%",
       "ok": true
      },
      {
       "label": "stressed DSCR 0.9-1.1x",
       "ok": true
      },
      {
       "label": "trajectory: sources before screen",
       "ok": true
      },
      {
       "label": "trajectory: no invented numbers (all tracked have source or formula)",
       "ok": true
      }
     ]
    },
    {
     "name": "sandcastle-hotel",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "keys = 150",
       "ok": true
      },
      {
       "label": "ADR extracted (100-170)",
       "ok": true
      },
      {
       "label": "NOI = 2,843,000 (memo Y3)",
       "ok": true
      },
      {
       "label": "price/basis = 18.4MM order of magnitude",
       "ok": true
      },
      {
       "label": "verdict is not KILL",
       "ok": true
      },
      {
       "label": "DSCR sane (0.5-3.0x)",
       "ok": true
      },
      {
       "label": "workbook generated",
       "ok": true
      },
      {
       "label": "6 sheets present",
       "ok": true
      },
      {
       "label": "hotel rooms revenue is a formula (keys x 365 x occ x ADR)",
       "ok": true
      },
      {
       "label": "rate built as index + spread",
       "ok": true
      }
     ]
    }
   ],
   "regression": {
    "prevCommit": "44b3847",
    "prevOverall": 1,
    "delta": 0,
    "regressed": false,
    "perCase": [
     {
      "name": "industrial-samples",
      "delta": 0
     },
     {
      "name": "sandcastle-hotel",
      "delta": 0
     }
    ]
   }
  },
  {
   "timestamp": "2026-07-26T03:04:53.600Z",
   "commit": "ca9b505",
   "overall": 1,
   "cases": [
    {
     "name": "industrial-samples",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "deal created",
       "ok": true
      },
      {
       "label": "T12 NOI = 304,600",
       "ok": true
      },
      {
       "label": "NOI confidence >= 0.8",
       "ok": true
      },
      {
       "label": "rent roll: 10 units",
       "ok": true
      },
      {
       "label": "asking price extracted",
       "ok": true
      },
      {
       "label": "verdict KILL at market rates",
       "ok": true
      },
      {
       "label": "DSCR kill flag triggered",
       "ok": true
      },
      {
       "label": "entry cap 6.5-8.5%",
       "ok": true
      },
      {
       "label": "stressed DSCR 0.9-1.1x",
       "ok": true
      },
      {
       "label": "trajectory: sources before screen",
       "ok": true
      },
      {
       "label": "trajectory: no invented numbers (all tracked have source or formula)",
       "ok": true
      }
     ]
    },
    {
     "name": "sandcastle-hotel",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "keys = 150",
       "ok": true
      },
      {
       "label": "ADR extracted (100-170)",
       "ok": true
      },
      {
       "label": "NOI = 2,843,000 (memo Y3)",
       "ok": true
      },
      {
       "label": "price/basis = 18.4MM order of magnitude",
       "ok": true
      },
      {
       "label": "verdict is not KILL",
       "ok": true
      },
      {
       "label": "DSCR sane (0.5-3.0x)",
       "ok": true
      },
      {
       "label": "workbook generated",
       "ok": true
      },
      {
       "label": "6 sheets present",
       "ok": true
      },
      {
       "label": "hotel rooms revenue is a formula (keys x 365 x occ x ADR)",
       "ok": true
      },
      {
       "label": "rate built as index + spread",
       "ok": true
      }
     ]
    }
   ],
   "regression": {
    "prevCommit": "85358fb",
    "prevOverall": 1,
    "delta": 0,
    "regressed": false,
    "perCase": [
     {
      "name": "industrial-samples",
      "delta": 0
     },
     {
      "name": "sandcastle-hotel",
      "delta": 0
     }
    ]
   }
  },
  {
   "timestamp": "2026-07-26T03:10:07.110Z",
   "commit": "07061d6",
   "overall": 1,
   "cases": [
    {
     "name": "industrial-samples",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "deal created",
       "ok": true
      },
      {
       "label": "T12 NOI = 304,600",
       "ok": true
      },
      {
       "label": "NOI confidence >= 0.8",
       "ok": true
      },
      {
       "label": "rent roll: 10 units",
       "ok": true
      },
      {
       "label": "asking price extracted",
       "ok": true
      },
      {
       "label": "verdict KILL at market rates",
       "ok": true
      },
      {
       "label": "DSCR kill flag triggered",
       "ok": true
      },
      {
       "label": "entry cap 6.5-8.5%",
       "ok": true
      },
      {
       "label": "stressed DSCR 0.9-1.1x",
       "ok": true
      },
      {
       "label": "trajectory: sources before screen",
       "ok": true
      },
      {
       "label": "trajectory: no invented numbers (all tracked have source or formula)",
       "ok": true
      }
     ]
    },
    {
     "name": "sandcastle-hotel",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "keys = 150",
       "ok": true
      },
      {
       "label": "ADR extracted (100-170)",
       "ok": true
      },
      {
       "label": "NOI = 2,843,000 (memo Y3)",
       "ok": true
      },
      {
       "label": "price/basis = 18.4MM order of magnitude",
       "ok": true
      },
      {
       "label": "verdict is not KILL",
       "ok": true
      },
      {
       "label": "DSCR sane (0.5-3.0x)",
       "ok": true
      },
      {
       "label": "workbook generated",
       "ok": true
      },
      {
       "label": "6 sheets present",
       "ok": true
      },
      {
       "label": "hotel rooms revenue is a formula (keys x 365 x occ x ADR)",
       "ok": true
      },
      {
       "label": "rate built as index + spread",
       "ok": true
      }
     ]
    }
   ],
   "regression": {
    "prevCommit": "ca9b505",
    "prevOverall": 1,
    "delta": 0,
    "regressed": false,
    "perCase": [
     {
      "name": "industrial-samples",
      "delta": 0
     },
     {
      "name": "sandcastle-hotel",
      "delta": 0
     }
    ]
   }
  },
  {
   "timestamp": "2026-07-26T12:22:22.470Z",
   "commit": "29be4f4",
   "overall": 1,
   "cases": [
    {
     "name": "industrial-samples",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "deal created",
       "ok": true
      },
      {
       "label": "T12 NOI = 304,600",
       "ok": true
      },
      {
       "label": "NOI confidence >= 0.8",
       "ok": true
      },
      {
       "label": "rent roll: 10 units",
       "ok": true
      },
      {
       "label": "asking price extracted",
       "ok": true
      },
      {
       "label": "verdict KILL at market rates",
       "ok": true
      },
      {
       "label": "DSCR kill flag triggered",
       "ok": true
      },
      {
       "label": "entry cap 6.5-8.5%",
       "ok": true
      },
      {
       "label": "stressed DSCR 0.9-1.1x",
       "ok": true
      },
      {
       "label": "trajectory: sources before screen",
       "ok": true
      },
      {
       "label": "trajectory: no invented numbers (all tracked have source or formula)",
       "ok": true
      }
     ]
    },
    {
     "name": "sandcastle-hotel",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "keys = 150",
       "ok": true
      },
      {
       "label": "ADR extracted (100-170)",
       "ok": true
      },
      {
       "label": "NOI = 2,843,000 (memo Y3)",
       "ok": true
      },
      {
       "label": "price/basis = 18.4MM order of magnitude",
       "ok": true
      },
      {
       "label": "verdict is not KILL",
       "ok": true
      },
      {
       "label": "DSCR sane (0.5-3.0x)",
       "ok": true
      },
      {
       "label": "workbook generated",
       "ok": true
      },
      {
       "label": "6 sheets present",
       "ok": true
      },
      {
       "label": "hotel rooms revenue is a formula (keys x 365 x occ x ADR)",
       "ok": true
      },
      {
       "label": "rate built as index + spread",
       "ok": true
      }
     ]
    }
   ],
   "regression": {
    "prevCommit": "07061d6",
    "prevOverall": 1,
    "delta": 0,
    "regressed": false,
    "perCase": [
     {
      "name": "industrial-samples",
      "delta": 0
     },
     {
      "name": "sandcastle-hotel",
      "delta": 0
     }
    ]
   }
  },
  {
   "timestamp": "2026-07-27T22:02:00.900Z",
   "commit": "36480a2",
   "overall": 1,
   "cases": [
    {
     "name": "industrial-samples",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "deal created",
       "ok": true
      },
      {
       "label": "T12 NOI = 304,600",
       "ok": true
      },
      {
       "label": "NOI confidence >= 0.8",
       "ok": true
      },
      {
       "label": "rent roll: 10 units",
       "ok": true
      },
      {
       "label": "asking price extracted",
       "ok": true
      },
      {
       "label": "verdict KILL at market rates",
       "ok": true
      },
      {
       "label": "DSCR kill flag triggered",
       "ok": true
      },
      {
       "label": "entry cap 6.5-8.5%",
       "ok": true
      },
      {
       "label": "stressed DSCR 0.9-1.1x",
       "ok": true
      },
      {
       "label": "trajectory: sources before screen",
       "ok": true
      },
      {
       "label": "trajectory: no invented numbers (all tracked have source or formula)",
       "ok": true
      }
     ]
    },
    {
     "name": "sandcastle-hotel",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "keys = 150",
       "ok": true
      },
      {
       "label": "ADR extracted (100-170)",
       "ok": true
      },
      {
       "label": "NOI = 2,843,000 (memo Y3)",
       "ok": true
      },
      {
       "label": "price/basis = 18.4MM order of magnitude",
       "ok": true
      },
      {
       "label": "verdict is not KILL",
       "ok": true
      },
      {
       "label": "DSCR sane (0.5-3.0x)",
       "ok": true
      },
      {
       "label": "workbook generated",
       "ok": true
      },
      {
       "label": "6 sheets present",
       "ok": true
      },
      {
       "label": "hotel rooms revenue is a formula (keys x 365 x occ x ADR)",
       "ok": true
      },
      {
       "label": "rate built as index + spread",
       "ok": true
      }
     ]
    }
   ],
   "regression": {
    "prevCommit": "29be4f4",
    "prevOverall": 1,
    "delta": 0,
    "regressed": false,
    "perCase": [
     {
      "name": "industrial-samples",
      "delta": 0
     },
     {
      "name": "sandcastle-hotel",
      "delta": 0
     }
    ]
   }
  },
  {
   "timestamp": "2026-07-27T22:20:57.432Z",
   "commit": "7552ecb",
   "overall": 1,
   "cases": [
    {
     "name": "industrial-samples",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "deal created",
       "ok": true
      },
      {
       "label": "T12 NOI = 304,600",
       "ok": true
      },
      {
       "label": "NOI confidence >= 0.8",
       "ok": true
      },
      {
       "label": "rent roll: 10 units",
       "ok": true
      },
      {
       "label": "asking price extracted",
       "ok": true
      },
      {
       "label": "verdict KILL at market rates",
       "ok": true
      },
      {
       "label": "DSCR kill flag triggered",
       "ok": true
      },
      {
       "label": "entry cap 6.5-8.5%",
       "ok": true
      },
      {
       "label": "stressed DSCR 0.9-1.1x",
       "ok": true
      },
      {
       "label": "trajectory: sources before screen",
       "ok": true
      },
      {
       "label": "trajectory: no invented numbers (all tracked have source or formula)",
       "ok": true
      }
     ]
    },
    {
     "name": "sandcastle-hotel",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "keys = 150",
       "ok": true
      },
      {
       "label": "ADR extracted (100-170)",
       "ok": true
      },
      {
       "label": "NOI = 2,843,000 (memo Y3)",
       "ok": true
      },
      {
       "label": "price/basis = 18.4MM order of magnitude",
       "ok": true
      },
      {
       "label": "verdict is not KILL",
       "ok": true
      },
      {
       "label": "DSCR sane (0.5-3.0x)",
       "ok": true
      },
      {
       "label": "workbook generated",
       "ok": true
      },
      {
       "label": "6 sheets present",
       "ok": true
      },
      {
       "label": "hotel rooms revenue is a formula (keys x 365 x occ x ADR)",
       "ok": true
      },
      {
       "label": "rate built as index + spread",
       "ok": true
      }
     ]
    }
   ],
   "regression": {
    "prevCommit": "36480a2",
    "prevOverall": 1,
    "delta": 0,
    "regressed": false,
    "perCase": [
     {
      "name": "industrial-samples",
      "delta": 0
     },
     {
      "name": "sandcastle-hotel",
      "delta": 0
     }
    ]
   }
  },
  {
   "timestamp": "2026-07-27T22:26:56.185Z",
   "commit": "6eb43f4",
   "overall": 1,
   "cases": [
    {
     "name": "industrial-samples",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "deal created",
       "ok": true
      },
      {
       "label": "T12 NOI = 304,600",
       "ok": true
      },
      {
       "label": "NOI confidence >= 0.8",
       "ok": true
      },
      {
       "label": "rent roll: 10 units",
       "ok": true
      },
      {
       "label": "asking price extracted",
       "ok": true
      },
      {
       "label": "verdict KILL at market rates",
       "ok": true
      },
      {
       "label": "DSCR kill flag triggered",
       "ok": true
      },
      {
       "label": "entry cap 6.5-8.5%",
       "ok": true
      },
      {
       "label": "stressed DSCR 0.9-1.1x",
       "ok": true
      },
      {
       "label": "trajectory: sources before screen",
       "ok": true
      },
      {
       "label": "trajectory: no invented numbers (all tracked have source or formula)",
       "ok": true
      }
     ]
    },
    {
     "name": "sandcastle-hotel",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "keys = 150",
       "ok": true
      },
      {
       "label": "ADR extracted (100-170)",
       "ok": true
      },
      {
       "label": "NOI = 2,843,000 (memo Y3)",
       "ok": true
      },
      {
       "label": "price/basis = 18.4MM order of magnitude",
       "ok": true
      },
      {
       "label": "verdict is not KILL",
       "ok": true
      },
      {
       "label": "DSCR sane (0.5-3.0x)",
       "ok": true
      },
      {
       "label": "workbook generated",
       "ok": true
      },
      {
       "label": "6 sheets present",
       "ok": true
      },
      {
       "label": "hotel rooms revenue is a formula (keys x 365 x occ x ADR)",
       "ok": true
      },
      {
       "label": "rate built as index + spread",
       "ok": true
      }
     ]
    }
   ],
   "regression": {
    "prevCommit": "7552ecb",
    "prevOverall": 1,
    "delta": 0,
    "regressed": false,
    "perCase": [
     {
      "name": "industrial-samples",
      "delta": 0
     },
     {
      "name": "sandcastle-hotel",
      "delta": 0
     }
    ]
   }
  },
  {
   "timestamp": "2026-07-27T22:54:10.474Z",
   "commit": "340b81d",
   "overall": 1,
   "cases": [
    {
     "name": "industrial-samples",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "deal created",
       "ok": true
      },
      {
       "label": "T12 NOI = 304,600",
       "ok": true
      },
      {
       "label": "NOI confidence >= 0.8",
       "ok": true
      },
      {
       "label": "rent roll: 10 units",
       "ok": true
      },
      {
       "label": "asking price extracted",
       "ok": true
      },
      {
       "label": "verdict KILL at market rates",
       "ok": true
      },
      {
       "label": "DSCR kill flag triggered",
       "ok": true
      },
      {
       "label": "entry cap 6.5-8.5%",
       "ok": true
      },
      {
       "label": "stressed DSCR 0.9-1.1x",
       "ok": true
      },
      {
       "label": "trajectory: sources before screen",
       "ok": true
      },
      {
       "label": "trajectory: no invented numbers (all tracked have source or formula)",
       "ok": true
      }
     ]
    },
    {
     "name": "sandcastle-hotel",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "keys = 150",
       "ok": true
      },
      {
       "label": "ADR extracted (100-170)",
       "ok": true
      },
      {
       "label": "NOI = 2,843,000 (memo Y3)",
       "ok": true
      },
      {
       "label": "price/basis = 18.4MM order of magnitude",
       "ok": true
      },
      {
       "label": "verdict is not KILL",
       "ok": true
      },
      {
       "label": "DSCR sane (0.5-3.0x)",
       "ok": true
      },
      {
       "label": "workbook generated",
       "ok": true
      },
      {
       "label": "10-sheet institutional layout",
       "ok": true
      },
      {
       "label": "RevPAR is a formula (occ x ADR)",
       "ok": true
      },
      {
       "label": "all-in rate built as index + spread bps",
       "ok": true
      },
      {
       "label": "perm takeout sized as min of three constraints",
       "ok": true
      },
      {
       "label": "sources & uses balance check present",
       "ok": true
      }
     ]
    }
   ],
   "regression": {
    "prevCommit": "6eb43f4",
    "prevOverall": 1,
    "delta": 0,
    "regressed": false,
    "perCase": [
     {
      "name": "industrial-samples",
      "delta": 0
     },
     {
      "name": "sandcastle-hotel",
      "delta": 0
     }
    ]
   }
  },
  {
   "timestamp": "2026-07-27T23:04:20.659Z",
   "commit": "1635881",
   "overall": 1,
   "cases": [
    {
     "name": "industrial-samples",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "deal created",
       "ok": true
      },
      {
       "label": "T12 NOI = 304,600",
       "ok": true
      },
      {
       "label": "NOI confidence >= 0.8",
       "ok": true
      },
      {
       "label": "rent roll: 10 units",
       "ok": true
      },
      {
       "label": "asking price extracted",
       "ok": true
      },
      {
       "label": "verdict KILL at market rates",
       "ok": true
      },
      {
       "label": "DSCR kill flag triggered",
       "ok": true
      },
      {
       "label": "entry cap 6.5-8.5%",
       "ok": true
      },
      {
       "label": "stressed DSCR 0.9-1.1x",
       "ok": true
      },
      {
       "label": "trajectory: sources before screen",
       "ok": true
      },
      {
       "label": "trajectory: no invented numbers (all tracked have source or formula)",
       "ok": true
      }
     ]
    },
    {
     "name": "sandcastle-hotel",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "keys = 150",
       "ok": true
      },
      {
       "label": "ADR extracted (100-170)",
       "ok": true
      },
      {
       "label": "NOI = 2,843,000 (memo Y3)",
       "ok": true
      },
      {
       "label": "price/basis = 18.4MM order of magnitude",
       "ok": true
      },
      {
       "label": "verdict is not KILL",
       "ok": true
      },
      {
       "label": "DSCR sane (0.5-3.0x)",
       "ok": true
      },
      {
       "label": "workbook generated",
       "ok": true
      },
      {
       "label": "10-sheet institutional layout",
       "ok": true
      },
      {
       "label": "RevPAR is a formula (occ x ADR)",
       "ok": true
      },
      {
       "label": "all-in rate built as index + spread bps",
       "ok": true
      },
      {
       "label": "perm takeout sized as min of three constraints",
       "ok": true
      },
      {
       "label": "sources & uses balance check present",
       "ok": true
      }
     ]
    }
   ],
   "regression": {
    "prevCommit": "340b81d",
    "prevOverall": 1,
    "delta": 0,
    "regressed": false,
    "perCase": [
     {
      "name": "industrial-samples",
      "delta": 0
     },
     {
      "name": "sandcastle-hotel",
      "delta": 0
     }
    ]
   }
  },
  {
   "timestamp": "2026-07-27T23:25:48.245Z",
   "commit": "51e8031",
   "overall": 1,
   "cases": [
    {
     "name": "industrial-samples",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "deal created",
       "ok": true
      },
      {
       "label": "T12 NOI = 304,600",
       "ok": true
      },
      {
       "label": "NOI confidence >= 0.8",
       "ok": true
      },
      {
       "label": "rent roll: 10 units",
       "ok": true
      },
      {
       "label": "asking price extracted",
       "ok": true
      },
      {
       "label": "verdict KILL at market rates",
       "ok": true
      },
      {
       "label": "DSCR kill flag triggered",
       "ok": true
      },
      {
       "label": "entry cap 6.5-8.5%",
       "ok": true
      },
      {
       "label": "stressed DSCR 0.9-1.1x",
       "ok": true
      },
      {
       "label": "trajectory: sources before screen",
       "ok": true
      },
      {
       "label": "trajectory: no invented numbers (all tracked have source or formula)",
       "ok": true
      }
     ]
    },
    {
     "name": "sandcastle-hotel",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "keys = 150",
       "ok": true
      },
      {
       "label": "ADR extracted (100-170)",
       "ok": true
      },
      {
       "label": "NOI = 2,843,000 (memo Y3)",
       "ok": true
      },
      {
       "label": "price/basis = 18.4MM order of magnitude",
       "ok": true
      },
      {
       "label": "verdict is not KILL",
       "ok": true
      },
      {
       "label": "DSCR sane (0.5-3.0x)",
       "ok": true
      },
      {
       "label": "workbook generated",
       "ok": true
      },
      {
       "label": "10-sheet institutional layout",
       "ok": true
      },
      {
       "label": "RevPAR is a formula (occ x ADR)",
       "ok": true
      },
      {
       "label": "all-in rate built as index + spread bps",
       "ok": true
      },
      {
       "label": "perm takeout sized as min of three constraints",
       "ok": true
      },
      {
       "label": "sources & uses balance check present",
       "ok": true
      }
     ]
    }
   ],
   "regression": {
    "prevCommit": "1635881",
    "prevOverall": 1,
    "delta": 0,
    "regressed": false,
    "perCase": [
     {
      "name": "industrial-samples",
      "delta": 0
     },
     {
      "name": "sandcastle-hotel",
      "delta": 0
     }
    ]
   }
  },
  {
   "timestamp": "2026-07-27T23:52:47.814Z",
   "commit": "f377931",
   "overall": 1,
   "cases": [
    {
     "name": "industrial-samples",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "deal created",
       "ok": true
      },
      {
       "label": "T12 NOI = 304,600",
       "ok": true
      },
      {
       "label": "NOI confidence >= 0.8",
       "ok": true
      },
      {
       "label": "rent roll: 10 units",
       "ok": true
      },
      {
       "label": "asking price extracted",
       "ok": true
      },
      {
       "label": "verdict KILL at market rates",
       "ok": true
      },
      {
       "label": "DSCR kill flag triggered",
       "ok": true
      },
      {
       "label": "entry cap 6.5-8.5%",
       "ok": true
      },
      {
       "label": "stressed DSCR 0.9-1.1x",
       "ok": true
      },
      {
       "label": "trajectory: sources before screen",
       "ok": true
      },
      {
       "label": "trajectory: no invented numbers (all tracked have source or formula)",
       "ok": true
      }
     ]
    },
    {
     "name": "sandcastle-hotel",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "keys = 150",
       "ok": true
      },
      {
       "label": "ADR extracted (100-170)",
       "ok": true
      },
      {
       "label": "NOI = 2,843,000 (memo Y3)",
       "ok": true
      },
      {
       "label": "price/basis = 18.4MM order of magnitude",
       "ok": true
      },
      {
       "label": "verdict is not KILL",
       "ok": true
      },
      {
       "label": "DSCR sane (0.5-3.0x)",
       "ok": true
      },
      {
       "label": "workbook generated",
       "ok": true
      },
      {
       "label": "10-sheet institutional layout",
       "ok": true
      },
      {
       "label": "RevPAR is a formula (occ x ADR)",
       "ok": true
      },
      {
       "label": "all-in rate built as index + spread bps",
       "ok": true
      },
      {
       "label": "perm takeout sized as min of three constraints",
       "ok": true
      },
      {
       "label": "sources & uses balance check present",
       "ok": true
      }
     ]
    }
   ],
   "regression": {
    "prevCommit": "51e8031",
    "prevOverall": 1,
    "delta": 0,
    "regressed": false,
    "perCase": [
     {
      "name": "industrial-samples",
      "delta": 0
     },
     {
      "name": "sandcastle-hotel",
      "delta": 0
     }
    ]
   }
  },
  {
   "timestamp": "2026-08-01T01:49:11.217Z",
   "commit": "a4b86ed",
   "overall": 0.955,
   "cases": [
    {
     "name": "industrial-samples",
     "rubric": {
      "correctness": 0.8181818181818182,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 0.909,
     "checks": [
      {
       "label": "deal created",
       "ok": true
      },
      {
       "label": "T12 NOI = 304,600",
       "ok": true
      },
      {
       "label": "NOI confidence >= 0.8",
       "ok": false
      },
      {
       "label": "rent roll: 10 units",
       "ok": true
      },
      {
       "label": "asking price extracted",
       "ok": true
      },
      {
       "label": "verdict KILL at market rates",
       "ok": true
      },
      {
       "label": "DSCR kill flag triggered",
       "ok": true
      },
      {
       "label": "entry cap 6.5-8.5%",
       "ok": true
      },
      {
       "label": "stressed DSCR 0.9-1.1x",
       "ok": false
      },
      {
       "label": "trajectory: sources before screen",
       "ok": true
      },
      {
       "label": "trajectory: no invented numbers (all tracked have source or formula)",
       "ok": true
      }
     ]
    },
    {
     "name": "sandcastle-hotel",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "keys = 150",
       "ok": true
      },
      {
       "label": "ADR extracted (100-170)",
       "ok": true
      },
      {
       "label": "NOI = 2,843,000 (memo Y3)",
       "ok": true
      },
      {
       "label": "price/basis = 18.4MM order of magnitude",
       "ok": true
      },
      {
       "label": "verdict is not KILL",
       "ok": true
      },
      {
       "label": "DSCR sane (0.5-3.0x)",
       "ok": true
      },
      {
       "label": "workbook generated",
       "ok": true
      },
      {
       "label": "10-sheet institutional layout",
       "ok": true
      },
      {
       "label": "RevPAR is a formula (occ x ADR)",
       "ok": true
      },
      {
       "label": "all-in rate built as index + spread bps",
       "ok": true
      },
      {
       "label": "perm takeout sized as min of three constraints",
       "ok": true
      },
      {
       "label": "sources & uses balance check present",
       "ok": true
      }
     ]
    }
   ],
   "regression": {
    "prevCommit": "f377931",
    "prevOverall": 1,
    "delta": -0.045,
    "regressed": true,
    "perCase": [
     {
      "name": "industrial-samples",
      "delta": -0.091
     },
     {
      "name": "sandcastle-hotel",
      "delta": 0
     }
    ]
   }
  },
  {
   "timestamp": "2026-08-01T01:51:02.019Z",
   "commit": "a4b86ed",
   "overall": 0.932,
   "cases": [
    {
     "name": "industrial-samples",
     "rubric": {
      "correctness": 0.7272727272727273,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 0.864,
     "checks": [
      {
       "label": "deal created",
       "ok": true
      },
      {
       "label": "T12 NOI = 304,600",
       "ok": false
      },
      {
       "label": "NOI confidence >= 0.8",
       "ok": false
      },
      {
       "label": "rent roll: 10 units",
       "ok": true
      },
      {
       "label": "asking price extracted",
       "ok": true
      },
      {
       "label": "verdict KILL at market rates",
       "ok": true
      },
      {
       "label": "DSCR kill flag triggered",
       "ok": true
      },
      {
       "label": "entry cap 6.5-8.5%",
       "ok": true
      },
      {
       "label": "stressed DSCR 0.9-1.1x",
       "ok": false
      },
      {
       "label": "trajectory: sources before screen",
       "ok": true
      },
      {
       "label": "trajectory: no invented numbers (all tracked have source or formula)",
       "ok": true
      }
     ]
    },
    {
     "name": "sandcastle-hotel",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "keys = 150",
       "ok": true
      },
      {
       "label": "ADR extracted (100-170)",
       "ok": true
      },
      {
       "label": "NOI = 2,843,000 (memo Y3)",
       "ok": true
      },
      {
       "label": "price/basis = 18.4MM order of magnitude",
       "ok": true
      },
      {
       "label": "verdict is not KILL",
       "ok": true
      },
      {
       "label": "DSCR sane (0.5-3.0x)",
       "ok": true
      },
      {
       "label": "workbook generated",
       "ok": true
      },
      {
       "label": "10-sheet institutional layout",
       "ok": true
      },
      {
       "label": "RevPAR is a formula (occ x ADR)",
       "ok": true
      },
      {
       "label": "all-in rate built as index + spread bps",
       "ok": true
      },
      {
       "label": "perm takeout sized as min of three constraints",
       "ok": true
      },
      {
       "label": "sources & uses balance check present",
       "ok": true
      }
     ]
    }
   ],
   "regression": {
    "prevCommit": "a4b86ed",
    "prevOverall": 0.955,
    "delta": -0.023,
    "regressed": true,
    "perCase": [
     {
      "name": "industrial-samples",
      "delta": -0.045
     },
     {
      "name": "sandcastle-hotel",
      "delta": 0
     }
    ]
   }
  },
  {
   "timestamp": "2026-08-01T01:51:51.382Z",
   "commit": "a4b86ed",
   "overall": 0.3,
   "cases": [
    {
     "name": "caseIndustrial",
     "rubric": {
      "correctness": 0,
      "completeness": 0,
      "consistency": 1,
      "cost": 1
     },
     "score": 0.3,
     "checks": [
      {
       "label": "case crashed: Command failed: node C:\\Real Estate\\mosaic-underwriting\\dist\\cli\\index.js new --name Golden Industrial --type industrial",
       "ok": false
      }
     ]
    },
    {
     "name": "caseSandcastle",
     "rubric": {
      "correctness": 0,
      "completeness": 0,
      "consistency": 1,
      "cost": 1
     },
     "score": 0.3,
     "checks": [
      {
       "label": "case crashed: Command failed: node C:\\Real Estate\\mosaic-underwriting\\dist\\cli\\index.js new --name Golden Sandcastle --type hotel --lo",
       "ok": false
      }
     ]
    }
   ],
   "regression": {
    "prevCommit": "a4b86ed",
    "prevOverall": 0.932,
    "delta": -0.632,
    "regressed": true,
    "perCase": [
     {
      "name": "caseIndustrial",
      "delta": null
     },
     {
      "name": "caseSandcastle",
      "delta": null
     }
    ]
   }
  },
  {
   "timestamp": "2026-08-01T01:52:12.396Z",
   "commit": "a4b86ed",
   "overall": 0.978,
   "cases": [
    {
     "name": "industrial-samples",
     "rubric": {
      "correctness": 0.9090909090909091,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 0.955,
     "checks": [
      {
       "label": "deal created",
       "ok": true
      },
      {
       "label": "T12 NOI = 304,600",
       "ok": true
      },
      {
       "label": "NOI confidence >= 0.8",
       "ok": true
      },
      {
       "label": "rent roll: 10 units",
       "ok": true
      },
      {
       "label": "asking price extracted",
       "ok": true
      },
      {
       "label": "verdict KILL at market rates",
       "ok": true
      },
      {
       "label": "DSCR kill flag triggered",
       "ok": true
      },
      {
       "label": "entry cap 6.5-8.5%",
       "ok": true
      },
      {
       "label": "stressed DSCR 0.9-1.1x",
       "ok": false
      },
      {
       "label": "trajectory: sources before screen",
       "ok": true
      },
      {
       "label": "trajectory: no invented numbers (all tracked have source or formula)",
       "ok": true
      }
     ]
    },
    {
     "name": "sandcastle-hotel",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "keys = 150",
       "ok": true
      },
      {
       "label": "ADR extracted (100-170)",
       "ok": true
      },
      {
       "label": "NOI = 2,843,000 (memo Y3)",
       "ok": true
      },
      {
       "label": "price/basis = 18.4MM order of magnitude",
       "ok": true
      },
      {
       "label": "verdict is not KILL",
       "ok": true
      },
      {
       "label": "DSCR sane (0.5-3.0x)",
       "ok": true
      },
      {
       "label": "workbook generated",
       "ok": true
      },
      {
       "label": "10-sheet institutional layout",
       "ok": true
      },
      {
       "label": "RevPAR is a formula (occ x ADR)",
       "ok": true
      },
      {
       "label": "all-in rate built as index + spread bps",
       "ok": true
      },
      {
       "label": "perm takeout sized as min of three constraints",
       "ok": true
      },
      {
       "label": "sources & uses balance check present",
       "ok": true
      }
     ]
    }
   ],
   "regression": {
    "prevCommit": "a4b86ed",
    "prevOverall": 0.3,
    "delta": 0.678,
    "regressed": false,
    "perCase": [
     {
      "name": "industrial-samples",
      "delta": null
     },
     {
      "name": "sandcastle-hotel",
      "delta": null
     }
    ]
   }
  },
  {
   "timestamp": "2026-08-01T01:52:50.775Z",
   "commit": "a4b86ed",
   "overall": 1,
   "cases": [
    {
     "name": "industrial-samples",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "deal created",
       "ok": true
      },
      {
       "label": "T12 NOI = 304,600",
       "ok": true
      },
      {
       "label": "NOI confidence >= 0.8",
       "ok": true
      },
      {
       "label": "rent roll: 10 units",
       "ok": true
      },
      {
       "label": "asking price extracted",
       "ok": true
      },
      {
       "label": "verdict KILL at market rates",
       "ok": true
      },
      {
       "label": "DSCR kill flag triggered",
       "ok": true
      },
      {
       "label": "entry cap 6.5-8.5%",
       "ok": true
      },
      {
       "label": "stressed DSCR 0.85-1.1x under adaptive stress",
       "ok": true
      },
      {
       "label": "T12 beats broker email on NOI (claims ledger)",
       "ok": true
      },
      {
       "label": "claims ledger populated with provenance",
       "ok": true
      },
      {
       "label": "trajectory: sources before screen",
       "ok": true
      },
      {
       "label": "trajectory: no invented numbers (all tracked have source or formula)",
       "ok": true
      }
     ]
    },
    {
     "name": "sandcastle-hotel",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "keys = 150",
       "ok": true
      },
      {
       "label": "ADR extracted (100-170)",
       "ok": true
      },
      {
       "label": "NOI = 2,843,000 (memo Y3)",
       "ok": true
      },
      {
       "label": "price/basis = 18.4MM order of magnitude",
       "ok": true
      },
      {
       "label": "verdict is not KILL",
       "ok": true
      },
      {
       "label": "DSCR sane (0.5-3.0x)",
       "ok": true
      },
      {
       "label": "workbook generated",
       "ok": true
      },
      {
       "label": "10-sheet institutional layout",
       "ok": true
      },
      {
       "label": "RevPAR is a formula (occ x ADR)",
       "ok": true
      },
      {
       "label": "all-in rate built as index + spread bps",
       "ok": true
      },
      {
       "label": "perm takeout sized as min of three constraints",
       "ok": true
      },
      {
       "label": "sources & uses balance check present",
       "ok": true
      }
     ]
    }
   ],
   "regression": {
    "prevCommit": "a4b86ed",
    "prevOverall": 0.978,
    "delta": 0.022,
    "regressed": false,
    "perCase": [
     {
      "name": "industrial-samples",
      "delta": 0.045
     },
     {
      "name": "sandcastle-hotel",
      "delta": 0
     }
    ]
   }
  },
  {
   "timestamp": "2026-08-01T01:56:24.427Z",
   "commit": "14418cd",
   "overall": 1,
   "cases": [
    {
     "name": "industrial-samples",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "deal created",
       "ok": true
      },
      {
       "label": "T12 NOI = 304,600",
       "ok": true
      },
      {
       "label": "NOI confidence >= 0.8",
       "ok": true
      },
      {
       "label": "rent roll: 10 units",
       "ok": true
      },
      {
       "label": "asking price extracted",
       "ok": true
      },
      {
       "label": "verdict KILL at market rates",
       "ok": true
      },
      {
       "label": "DSCR kill flag triggered",
       "ok": true
      },
      {
       "label": "entry cap 6.5-8.5%",
       "ok": true
      },
      {
       "label": "stressed DSCR 0.85-1.1x under adaptive stress",
       "ok": true
      },
      {
       "label": "T12 beats broker email on NOI (claims ledger)",
       "ok": true
      },
      {
       "label": "claims ledger populated with provenance",
       "ok": true
      },
      {
       "label": "trajectory: sources before screen",
       "ok": true
      },
      {
       "label": "trajectory: no invented numbers (all tracked have source or formula)",
       "ok": true
      }
     ]
    },
    {
     "name": "sandcastle-hotel",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "keys = 150",
       "ok": true
      },
      {
       "label": "ADR extracted (100-170)",
       "ok": true
      },
      {
       "label": "NOI = 2,843,000 (memo Y3)",
       "ok": true
      },
      {
       "label": "price/basis = 18.4MM order of magnitude",
       "ok": true
      },
      {
       "label": "verdict is not KILL",
       "ok": true
      },
      {
       "label": "DSCR sane (0.5-3.0x)",
       "ok": true
      },
      {
       "label": "workbook generated",
       "ok": true
      },
      {
       "label": "10-sheet institutional layout",
       "ok": true
      },
      {
       "label": "RevPAR is a formula (occ x ADR)",
       "ok": true
      },
      {
       "label": "all-in rate built as index + spread bps",
       "ok": true
      },
      {
       "label": "perm takeout sized as min of three constraints",
       "ok": true
      },
      {
       "label": "sources & uses balance check present",
       "ok": true
      }
     ]
    }
   ],
   "regression": {
    "prevCommit": "a4b86ed",
    "prevOverall": 1,
    "delta": 0,
    "regressed": false,
    "perCase": [
     {
      "name": "industrial-samples",
      "delta": 0
     },
     {
      "name": "sandcastle-hotel",
      "delta": 0
     }
    ]
   }
  },
  {
   "timestamp": "2026-08-01T02:05:25.183Z",
   "commit": "14418cd",
   "overall": 1,
   "cases": [
    {
     "name": "industrial-samples",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "deal created",
       "ok": true
      },
      {
       "label": "T12 NOI = 304,600",
       "ok": true
      },
      {
       "label": "NOI confidence >= 0.8",
       "ok": true
      },
      {
       "label": "rent roll: 10 units",
       "ok": true
      },
      {
       "label": "asking price extracted",
       "ok": true
      },
      {
       "label": "verdict KILL at market rates",
       "ok": true
      },
      {
       "label": "DSCR kill flag triggered",
       "ok": true
      },
      {
       "label": "entry cap 6.5-8.5%",
       "ok": true
      },
      {
       "label": "stressed DSCR 0.85-1.1x under adaptive stress",
       "ok": true
      },
      {
       "label": "T12 beats broker email on NOI (claims ledger)",
       "ok": true
      },
      {
       "label": "claims ledger populated with provenance",
       "ok": true
      },
      {
       "label": "trajectory: sources before screen",
       "ok": true
      },
      {
       "label": "trajectory: no invented numbers (all tracked have source or formula)",
       "ok": true
      }
     ]
    },
    {
     "name": "sandcastle-hotel",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "keys = 150",
       "ok": true
      },
      {
       "label": "ADR extracted (100-170)",
       "ok": true
      },
      {
       "label": "NOI = 2,843,000 (memo Y3)",
       "ok": true
      },
      {
       "label": "price/basis = 18.4MM order of magnitude",
       "ok": true
      },
      {
       "label": "verdict is not KILL",
       "ok": true
      },
      {
       "label": "DSCR sane (0.5-3.0x)",
       "ok": true
      },
      {
       "label": "workbook generated",
       "ok": true
      },
      {
       "label": "10-sheet institutional layout",
       "ok": true
      },
      {
       "label": "RevPAR is a formula (occ x ADR)",
       "ok": true
      },
      {
       "label": "all-in rate built as index + spread bps",
       "ok": true
      },
      {
       "label": "perm takeout sized as min of three constraints",
       "ok": true
      },
      {
       "label": "sources & uses balance check present",
       "ok": true
      }
     ]
    }
   ],
   "regression": {
    "prevCommit": "14418cd",
    "prevOverall": 1,
    "delta": 0,
    "regressed": false,
    "perCase": [
     {
      "name": "industrial-samples",
      "delta": 0
     },
     {
      "name": "sandcastle-hotel",
      "delta": 0
     }
    ]
   }
  },
  {
   "timestamp": "2026-08-01T21:36:53.918Z",
   "commit": "2b6bb5e",
   "overall": 1,
   "cases": [
    {
     "name": "industrial-samples",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "deal created",
       "ok": true
      },
      {
       "label": "T12 NOI = 304,600",
       "ok": true
      },
      {
       "label": "NOI confidence >= 0.8",
       "ok": true
      },
      {
       "label": "rent roll: 10 units",
       "ok": true
      },
      {
       "label": "asking price extracted",
       "ok": true
      },
      {
       "label": "verdict KILL at market rates",
       "ok": true
      },
      {
       "label": "DSCR kill flag triggered",
       "ok": true
      },
      {
       "label": "entry cap 6.5-8.5%",
       "ok": true
      },
      {
       "label": "stressed DSCR 0.85-1.1x under adaptive stress",
       "ok": true
      },
      {
       "label": "T12 beats broker email on NOI (claims ledger)",
       "ok": true
      },
      {
       "label": "claims ledger populated with provenance",
       "ok": true
      },
      {
       "label": "trajectory: sources before screen",
       "ok": true
      },
      {
       "label": "trajectory: no invented numbers (all tracked have source or formula)",
       "ok": true
      }
     ]
    },
    {
     "name": "sandcastle-hotel",
     "rubric": {
      "correctness": 1,
      "completeness": 1,
      "consistency": 1,
      "cost": 1
     },
     "score": 1,
     "checks": [
      {
       "label": "keys = 150",
       "ok": true
      },
      {
       "label": "ADR extracted (100-170)",
       "ok": true
      },
      {
       "label": "NOI = 2,843,000 (memo Y3)",
       "ok": true
      },
      {
       "label": "price/basis = 18.4MM order of magnitude",
       "ok": true
      },
      {
       "label": "verdict is not KILL",
       "ok": true
      },
      {
       "label": "DSCR sane (0.5-3.0x)",
       "ok": true
      },
      {
       "label": "workbook generated",
       "ok": true
      },
      {
       "label": "10-sheet institutional layout",
       "ok": true
      },
      {
       "label": "RevPAR is a formula (occ x ADR)",
       "ok": true
      },
      {
       "label": "all-in rate built as index + spread bps",
       "ok": true
      },
      {
       "label": "perm takeout sized as min of three constraints",
       "ok": true
      },
      {
       "label": "sources & uses balance check present",
       "ok": true
      }
     ]
    }
   ],
   "regression": {
    "prevCommit": "14418cd",
    "prevOverall": 1,
    "delta": 0,
    "regressed": false,
    "perCase": [
     {
      "name": "industrial-samples",
      "delta": 0
     },
     {
      "name": "sandcastle-hotel",
      "delta": 0
     }
    ]
   }
  }
 ]
};