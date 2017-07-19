import React from 'react'

class Numbers extends React.Component {
  state = {count: this.props.count}

  incr = () => this.setState(({count}) => ({count: count + 1}))

  render() {
    const {count} = this.state
    return <ol onClick={this.incr}> {
      new Array(count).fill('x').map((x, i) => <li key={i}>{i}</li>)
    } </ol>
  }
}

export default <div>
  <h1>Hello world.</h1>
  <p>Here's a list of a twenty numbers:</p>
  <Numbers count={5}/>
</div>