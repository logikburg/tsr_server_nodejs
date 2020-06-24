module.exports = async function (field, model, data, next) {
  if (data.isNew) {
    let total = await model.find().sort({ seq: -1 }).limit(1);
    data.seq = total.length === 0 ? 1 : Number(total[0].seq) + 1;
    data[field] = data[field] + data.seq.toString();
    next();
  };
};