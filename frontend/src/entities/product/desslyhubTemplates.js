// Predefined DesslyHub fulfillment templates for new products.
// Each template prefills `provider_service`, `provider_params` and
// `checkout_requirements` so the admin can tweak fields/paths per product.

const STATUS_ORDERS = {
  method: "GET",
  path: "/orders/{order_id}",
  status_path: "order_status",
  delivered_payload_path: "service_result",
  success_values: ["completed"],
  failed_values: ["failed", "canceled"],
};

const STATUS_LEGACY = {
  method: "GET",
  path: "/merchants/transaction/{transaction_id}/status",
  status_path: "status",
  delivered_payload_path: "result",
  success_values: ["success", "completed", "ok"],
  failed_values: ["failed", "error", "canceled", "rejected"],
};

export const DESSLYHUB_TEMPLATES = {
  steam_gift: {
    label: "Steam Gift (подарок в Steam)",
    provider_service: "steam_gift",
    provider_params: {
      package_id: "REPLACE_ME",
      region: "RU",
    },
    checkout_requirements: {
      profile_type: "steam_gift",
      fields: [
        {
          key: "invite_url",
          label: "Steam invite URL",
          required: true,
          placeholder: "https://s.team/p/...",
        },
      ],
      request: {
        method: "POST",
        path: "/orders",
        body: {
          payment_method: "balance",
          service_type: "steam_gift",
          reference: "{{order.public_id}}",
          service_params: {
            invite_url: "{{profile.invite_url}}",
            package_id: "{{product.package_id}}",
            region: "{{product.region}}",
          },
        },
      },
      response: { transaction_id_path: "order_id" },
      status: STATUS_ORDERS,
    },
  },

  steam_topup: {
    label: "Steam Top-up (пополнение Steam)",
    provider_service: "steam_topup",
    provider_params: {
      amount: "100",
      currency: "RUB",
    },
    checkout_requirements: {
      profile_type: "steam",
      fields: [
        {
          key: "steam_login",
          label: "Steam login",
          required: true,
          placeholder: "Логин Steam",
        },
      ],
      request: {
        method: "POST",
        path: "/orders",
        body: {
          payment_method: "balance",
          service_type: "steam_refill",
          reference: "{{order.public_id}}",
          service_params: {
            username: "{{profile.steam_login}}",
            amount: "{{product.amount}}",
          },
        },
      },
      response: { transaction_id_path: "order_id" },
      status: STATUS_ORDERS,
    },
  },

  voucher_desslyhub: {
    label: "Voucher DesslyHub (root_id + variant_id)",
    provider_service: "voucher_desslyhub",
    provider_params: {
      root_id: "REPLACE_ME",
      variant_id: "REPLACE_ME",
    },
    checkout_requirements: {
      profile_type: "voucher",
      fields: [],
      request: {
        method: "POST",
        path: "/orders",
        body: {
          payment_method: "balance",
          service_type: "voucher",
          reference: "{{order.public_id}}",
          service_params: {
            root_id: "{{product.root_id}}",
            variant_id: "{{product.variant_id}}",
            quantity: 1,
          },
        },
      },
      response: { transaction_id_path: "order_id" },
      status: STATUS_ORDERS,
    },
  },

  voucher_code: {
    label: "Voucher / Code (выдача кодом)",
    provider_service: "voucher_code",
    provider_params: {
      sku: "REPLACE_ME",
      region: "RU",
    },
    checkout_requirements: {
      profile_type: "voucher",
      fields: [
        {
          key: "email",
          label: "Email для доставки кода (опционально)",
          required: false,
          placeholder: "you@example.com",
        },
      ],
      request: {
        method: "POST",
        path: "/voucher",
        body: {
          sku: "{{product.sku}}",
          region: "{{product.region}}",
          email: "{{profile.email}}",
          reference: "{{order.public_id}}",
        },
      },
      response: { transaction_id_path: "transaction_id" },
      status: {
        ...STATUS_LEGACY,
        delivered_payload_path: "result",
      },
    },
  },

  game_topup_id: {
    label: "Game Top-up by ID (mobile refill)",
    provider_service: "game_topup_id",
    provider_params: {
      game: "REPLACE_ME",
      package_id: "REPLACE_ME",
      region: "RU",
    },
    checkout_requirements: {
      profile_type: "game_id",
      fields: [
        {
          key: "game_id",
          label: "Game ID / UID",
          required: true,
          placeholder: "123456789",
        },
        {
          key: "server",
          label: "Server (если требуется)",
          required: false,
          placeholder: "asia / europe / ...",
        },
        {
          key: "region",
          label: "Регион (если требуется)",
          required: false,
          placeholder: "RU / EU / ...",
        },
      ],
      request: {
        method: "POST",
        path: "/orders",
        body: {
          payment_method: "balance",
          service_type: "mobile_refill",
          reference: "{{order.public_id}}",
          service_params: {
            position: "{{product.package_id}}",
            fields: {
              game_id: "{{profile.game_id}}",
              server: "{{profile.server}}",
              region: "{{profile.region}}",
            },
          },
        },
      },
      response: { transaction_id_path: "order_id" },
      status: STATUS_ORDERS,
    },
  },
};

export const DESSLYHUB_TEMPLATE_OPTIONS = Object.entries(DESSLYHUB_TEMPLATES).map(
  ([key, tpl]) => ({ key, label: tpl.label })
);
