import BusinessCentralModuleService from "../service";

const originalFetch = global.fetch;

describe("BusinessCentralModuleService.createReturnFromSalesOrder", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns a deterministic return order without making a network request", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const service = new BusinessCentralModuleService();
    const params = {
      requestId: "RET-123456",
      sourceOrderNo: "SO-1000",
      lines: [
        {
          sourceLineNo: 10000,
          quantityToReturn: 2,
          returnReasonCode: "DAMAGED",
        },
      ],
    };

    await expect(service.createReturnFromSalesOrder(params)).resolves.toEqual({
      id: "bcret_stub_RET-123456",
      number: "RET-123456",
      status: "Open",
      requestId: "RET-123456",
      sourceOrderNo: "SO-1000",
      lines: [
        {
          sourceLineNo: 10000,
          quantityToReturn: 2,
          returnReasonCode: "DAMAGED",
        },
      ],
    });
    await expect(service.createReturnFromSalesOrder(params)).resolves.toEqual({
      id: "bcret_stub_RET-123456",
      number: "RET-123456",
      status: "Open",
      requestId: "RET-123456",
      sourceOrderNo: "SO-1000",
      lines: [
        {
          sourceLineNo: 10000,
          quantityToReturn: 2,
          returnReasonCode: "DAMAGED",
        },
      ],
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects return requests without a line or a positive quantity", async () => {
    const service = new BusinessCentralModuleService();

    await expect(
      service.createReturnFromSalesOrder({
        requestId: "RET-123456",
        sourceOrderNo: "SO-1000",
        lines: [],
      })
    ).rejects.toThrow("at least one line");
    await expect(
      service.createReturnFromSalesOrder({
        requestId: "RET-123456",
        sourceOrderNo: "SO-1000",
        lines: [
          {
            sourceLineNo: 10000,
            quantityToReturn: 0,
            returnReasonCode: "DAMAGED",
          },
        ],
      })
    ).rejects.toThrow("positive quantity");
  });
});

describe("BusinessCentralModuleService.listReturnReasons", () => {
  it("returns unique return reason IDs with descriptions", async () => {
    const service = new BusinessCentralModuleService();

    const reasons = await service.listReturnReasons();

    expect(reasons).not.toHaveLength(0);
    expect(new Set(reasons.map((reason) => reason.id)).size).toBe(
      reasons.length
    );
    for (const reason of reasons) {
      expect(reason.id).not.toHaveLength(0);
      expect(reason.description.length).toBeGreaterThan(reason.id.length);
    }
  });
});
