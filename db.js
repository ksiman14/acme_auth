const jwt = require('jsonwebtoken');
const Sequelize = require('sequelize');
const bcrypt = require('bcrypt');
const { STRING } = Sequelize;
const config = {
  logging: false,
};

if (process.env.LOGGING) {
  delete config.logging;
}
const conn = new Sequelize(
  process.env.DATABASE_URL || 'postgres://localhost/acme_db',
  config
);

const User = conn.define('user', {
  username: STRING,
  password: STRING,
});

const Note = conn.define('note', {
  text: STRING,
});

Note.belongsTo(User);
User.hasMany(Note);

User.byToken = async (token) => {
  try {
    const payload = jwt.verify(token, process.env.JWT);
    const user = await User.findByPk(payload.userId);
    if (user) {
      return user;
    }
    const error = Error('bad credentials');
    error.status = 401;
    throw error;
  } catch (ex) {
    const error = Error('bad credentials');
    error.status = 401;
    throw error;
  }
};

User.authenticate = async ({ username, password }) => {
  const user = await User.findOne({
    where: {
      username,
    },
  });
  if (user) {
    if (bcrypt.compareSync(password, user.password)) {
      if (user) {
        const token = jwt.sign({ userId: user.id }, process.env.JWT);
        return token;
      }
    }
  }
  const error = Error('bad credentials');
  error.status = 401;
  throw error;
};

User.beforeCreate(async (user) => {
  const hash = bcrypt.hashSync(user.password, 10);
  user.password = hash;
});

const syncAndSeed = async () => {
  await conn.sync({ force: true });
  const credentials = [
    { username: 'lucy', password: 'lucy_pw' },
    { username: 'moe', password: 'moe_pw' },
    { username: 'larry', password: 'larry_pw' },
  ];
  const [lucy, moe, larry] = await Promise.all(
    credentials.map((credential) => User.create(credential))
  );
  const notes = [{ text: 'Note 1' }, { text: 'Note 2' }, { text: 'Note 3' }];

  const [note1, note2, note3] = await Promise.all(
    notes.map((note) => Note.create(note))
  );

  await lucy.addNote(note1);
  await moe.addNote(note2);
  await larry.addNote(note3);

  return {
    users: {
      lucy,
      moe,
      larry,
    },
  };
};

module.exports = {
  syncAndSeed,
  models: {
    User,
    Note,
  },
};
