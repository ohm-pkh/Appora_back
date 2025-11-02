import timeFormat from "../function/timeFormat";

describe('timeFormat', ()=>{
    test('NormalTime', () => {
        expect(timeFormat("09:30:00")).toBe("09:30");
    })
});