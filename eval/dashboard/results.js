window.EVAL_DATA = {
 "latest": {
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
  }
 ]
};