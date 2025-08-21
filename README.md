Work in Progress, please wait patiently. Thanks!

public/
│
├── config/
│   └── supabaseConfig.js        # Database configuration
│   └── appConfig.js              # Application settings
│
├── core/
│   ├── BaseModel.js              # Base model class
│   ├── BaseView.js               # Base view class
│   └── BaseController.js         # Base controller class
│
├── models/
│   ├── BOKModel.js               # BOK data model
│   ├── TPGModel.js               # TPG data model
│   ├── DDModel.js                # Dana Desa data model
│   └── SP2DModel.js              # SP2D data model
│
├── views/
│   ├── BOKView.js                # BOK UI rendering
│   ├── TPGView.js                # TPG UI rendering
│   ├── DDView.js                 # Dana Desa UI rendering
│   └── SP2DView.js               # SP2D UI rendering
│
├── controllers/
│   ├── BOKController.js          # BOK business logic
│   ├── TPGController.js          # TPG business logic
│   ├── DDController.js           # Dana Desa business logic
│   └── SP2DController.js         # SP2D business logic
│
├── main/
│   ├── app.js                    # Main application entry
│   └── applicationFactory.js     # Module factory
│
├── utils/
│   ├── errorHandler.js           # Error handling utilities
│   └── validators.js             # Input validation utilities
│
├── pages/
│   ├── BOK.html                  # BOK page
│   ├── TKG.html                  # TPG page
│   ├── DD.html                   # Dana Desa page
│   └── SP2D.html                 # SP2D page
│
└── assets/
    ├── css/
    ├── js/
    └── images/
